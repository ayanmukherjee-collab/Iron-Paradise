// The staff lists that grow with payment history (the payment sheet, the
// members list behind the dashboard, members and attendance pages), run
// against the real migrations. Each is checked by hand on the cases that
// matter and, as a whole, against a copy of how it used to be built (every
// payment pulled into the Worker), so the cheaper queries change nothing.
import { asc, desc, eq, isNull, max } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/auth/viewer";
import { can } from "@/auth/permissions";
import {
  attendance,
  gymSettings,
  members,
  memberships,
  paymentVoids,
  payments,
} from "@/db/schema";
import {
  createTestDatabase,
  type AppRole,
  type TestDatabase,
} from "@/db/testing/test-database";
import { withUserContext, type Database } from "@/db/user-context";
import { addDays, addMonthsClamped, todayAtGym } from "@/lib/dates";
import {
  feeOn,
  isGoneQuiet,
  membershipStatus,
  nextDueDate,
} from "@/members/billing";
import type { MembershipRow } from "@/members/facts";
import type { MemberSummary } from "@/members/queries";
import { sheetMonths, sheetRow, type MembershipLedger } from "@/payments/sheet";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ db: null as Database | null }));
vi.mock("@/db/client", () => ({ getDb: () => state.db! }));

const { getPaymentSheet, loadFactsAndLedgers } =
  await import("@/payments/queries");
const { listMembers } = await import("@/members/queries");

type SheetRow = Awaited<ReturnType<typeof getPaymentSheet>>[number];

let t: TestDatabase;
let owner: string;
const viewers = {} as Record<"owner" | "manager" | "trainer", Viewer>;
const ids: Record<string, { member: string; membership?: string }> = {};

const today = todayAtGym();
const thisMonth = today.slice(0, 7);
const day = (offset: number) => addDays(today, offset);
const monthsAgo = (months: number) => addMonthsClamped(today, -months);

async function addMember(name: string, active = true) {
  const member = await t.createMember({ name });
  if (!active) {
    await t.client.query(
      "update public.members set is_active = false where id = $1",
      [member],
    );
  }
  ids[name] = { member };
  return member;
}

async function addMembership(
  name: string,
  startsOn: string,
  feePaise: number,
  endedOn: string | null = null,
) {
  const result = await t.client.query<{ id: string }>(
    "insert into public.memberships (member_id, starts_on, ended_on) values ($1, $2, $3) returning id",
    [ids[name].member, startsOn, endedOn],
  );
  const membership = result.rows[0].id;
  await t.client.query(
    "insert into public.membership_fees (membership_id, fee_paise, effective_from, set_by) values ($1, $2, $3, $4)",
    [membership, feePaise, startsOn, owner],
  );
  if (!endedOn) ids[name].membership = membership;
  return membership;
}

async function changeFee(membership: string, feePaise: number, from: string) {
  await t.client.query(
    "insert into public.membership_fees (membership_id, fee_paise, effective_from, set_by) values ($1, $2, $3, $4)",
    [membership, feePaise, from, owner],
  );
}

async function freeze(membership: string, from: string, to: string | null) {
  await t.client.query(
    "insert into public.membership_freezes (membership_id, starts_on, ends_on, created_by) values ($1, $2, $3, $4)",
    [membership, from, to, owner],
  );
}

let recorded = 0;
/** Records a payment; each one is stamped a minute after the last. */
async function pay(
  name: string,
  membership: string,
  firstPeriod: number,
  amountPaise: number,
  paidOn: string,
  recordedAt = new Date(Date.UTC(2026, 0, 1, 0, recorded++)),
) {
  const result = await t.client.query<{ id: string }>(
    `insert into public.payments (member_id, membership_id, first_period, amount_paise, method, paid_on, recorded_by, created_at)
     values ($1, $2, $3, $4, 'cash', $5, $6, $7) returning id`,
    [
      ids[name].member,
      membership,
      firstPeriod,
      amountPaise,
      paidOn,
      owner,
      recordedAt,
    ],
  );
  return result.rows[0].id;
}

async function voidPayment(payment: string) {
  await t.client.query(
    "insert into public.payment_voids (payment_id, reason, voided_by) values ($1, 'entered twice', $2)",
    [payment, owner],
  );
}

async function viewer(role: AppRole & keyof typeof viewers) {
  const userId = role === "owner" ? owner : await t.createUser(role);
  viewers[role] = {
    userId,
    fullName: `${role} user`,
    email: null,
    role,
    isActive: true,
  };
}

beforeAll(async () => {
  t = await createTestDatabase();
  state.db = t.db;
  owner = await t.createUser("owner");
  await viewer("owner");
  await viewer("manager");
  await viewer("trainer");

  // Recorded times are set here, not stamped by the database, so the
  // "newest recorded" tie-break below is certain.
  await t.client.query(
    "alter table public.payments disable trigger payments_stamp_created_at",
  );

  // Paid every month for a year, then two part-payments towards the next.
  await addMember("Asha");
  const asha = await addMembership("Asha", monthsAgo(14), 60000);
  for (let period = 0; period <= 12; period++) {
    await pay(
      "Asha",
      asha,
      period,
      60000,
      addMonthsClamped(monthsAgo(14), period),
    );
  }
  await pay("Asha", asha, 13, 30000, day(-40));
  await pay("Asha", asha, 13, 20000, today);

  // Two payments on the same day: the one recorded later is the last.
  await addMember("Bala");
  const bala = await addMembership("Bala", monthsAgo(3), 80000);
  await pay("Bala", bala, 0, 80000, monthsAgo(3));
  await pay("Bala", bala, 1, 50000, today, new Date("2026-02-01T10:00:00Z"));
  await pay("Bala", bala, 1, 30000, today, new Date("2026-02-01T11:00:00Z"));
  // Recorded earlier still, and on an earlier day: never the last.
  await pay("Bala", bala, 2, 160000, day(-1), new Date("2026-02-01T12:00:00Z"));

  // The newest payment was voided: it is not the last, nor this month's.
  await addMember("Chitra");
  const chitra = await addMembership("Chitra", monthsAgo(6), 60000);
  await pay("Chitra", chitra, 0, 180000, monthsAgo(6));
  await voidPayment(await pay("Chitra", chitra, 3, 60000, today));

  // Marked inactive but with an open membership: no dues, but still owes.
  await addMember("Dev", false);
  await addMembership("Dev", monthsAgo(5), 60000);

  await addMember("Esha");
  await addMembership("Esha", monthsAgo(4), 0);

  // Frozen until further notice.
  await addMember("Farid");
  const farid = await addMembership("Farid", monthsAgo(8), 70000);
  await pay("Farid", farid, 0, 140000, monthsAgo(8));
  await freeze(farid, day(-10), null);

  // Owes on an old membership; the new one is paid up.
  await addMember("Gita");
  const old = await addMembership("Gita", monthsAgo(20), 50000, monthsAgo(10));
  await pay("Gita", old, 0, 100000, monthsAgo(20));
  const gita = await addMembership("Gita", monthsAgo(2), 55000);
  await pay("Gita", gita, 0, 165000, monthsAgo(2));

  // A month's freeze, and a raise half-way.
  await addMember("Hari");
  const hari = await addMembership("Hari", monthsAgo(12), 60000);
  await freeze(hari, monthsAgo(9), addDays(monthsAgo(9), 30));
  await changeFee(hari, 65000, monthsAgo(6));
  for (let period = 0; period < 10; period++) {
    await pay(
      "Hari",
      hari,
      period,
      period < 6 ? 60000 : 65000,
      day(-300 + period * 30),
    );
  }

  // Never paid at all.
  await addMember("Isha");
  await addMembership("Isha", day(-40), 60000);

  // No membership.
  await addMember("Jay");

  // Joined yesterday, paid on the day.
  await addMember("Kiran");
  const kiran = await addMembership("Kiran", day(-1), 60000);
  await pay("Kiran", kiran, 0, 60000, day(-1));

  await t.client.query(
    "alter table public.payments enable trigger payments_stamp_created_at",
  );
}, 60_000);

const rowOf = (rows: SheetRow[], name: string) =>
  rows.find((row) => row.memberId === ids[name].member);

describe("the payment sheet", () => {
  it("takes the last payment by day, then by when it was recorded", async () => {
    const rows = await getPaymentSheet(viewers.owner, []);
    expect(rowOf(rows, "Bala")?.lastPayment).toEqual({
      amountPaise: 30000,
      paidOn: today,
    });
    expect(rowOf(rows, "Bala")?.paidThisMonthPaise).toBe(
      day(-1).startsWith(thisMonth) ? 240000 : 80000,
    );
  });

  it("leaves voided payments out of the last payment and this month", async () => {
    const rows = await getPaymentSheet(viewers.owner, []);
    expect(rowOf(rows, "Chitra")?.lastPayment).toEqual({
      amountPaise: 180000,
      paidOn: monthsAgo(6),
    });
    expect(rowOf(rows, "Chitra")?.paidThisMonthPaise).toBe(0);
  });

  it("adds up this month's payments, and only this month's", async () => {
    const rows = await getPaymentSheet(viewers.owner, []);
    const asha = rowOf(rows, "Asha")!;
    expect(asha.lastPayment).toEqual({ amountPaise: 20000, paidOn: today });
    const sameMonth = day(-40).startsWith(thisMonth);
    expect(asha.paidThisMonthPaise).toBe(sameMonth ? 50000 : 20000);
    expect(rowOf(rows, "Isha")).toMatchObject({
      lastPayment: null,
      paidThisMonthPaise: 0,
    });
  });

  it("keeps old debts and inactive members' debts on their rows", async () => {
    const rows = await getPaymentSheet(viewers.owner, []);
    expect(rowOf(rows, "Gita")!.owedPaise).toBeGreaterThan(0);
    expect(rowOf(rows, "Gita")!.standing).toBe("paid");
    expect(rowOf(rows, "Dev")).toMatchObject({ standing: null, nextDue: null });
    expect(rowOf(rows, "Dev")!.owedPaise).toBeGreaterThan(0);
    expect(rowOf(rows, "Jay")).toBeUndefined();
  });

  it("is what it was when every payment was loaded, cells and all", async () => {
    const months = sheetMonths(null, today);
    for (const role of ["owner", "manager"] as const) {
      expect(await getPaymentSheet(viewers[role], months)).toEqual(
        await originalPaymentSheet(viewers[role], months),
      );
    }
  });
});

describe("the members list", () => {
  it("shows inactive members as inactive, with nothing owed or due", async () => {
    const everyone = await listMembers(viewers.owner);
    expect(everyone.find((m) => m.fullName === "Dev")).toMatchObject({
      status: "inactive",
      standing: null,
      owedPaise: 0,
      nextDue: null,
      feePaise: null,
    });
    expect(everyone.find((m) => m.fullName === "Jay")?.status).toBe("inactive");
  });

  it("is what it was when every payment was loaded, for every staff role", async () => {
    for (const role of ["owner", "manager", "trainer"] as const) {
      const now = await listMembers(viewers[role]);
      expect(now).toEqual(await originalListMembers(viewers[role]));
      expect(now.length).toBe(11);
    }
  });

  it("gives trainers statuses and due dates but no money", async () => {
    const everyone = await listMembers(viewers.trainer);
    expect(everyone.find((m) => m.fullName === "Farid")?.status).toBe("frozen");
    // Free needs the fee, which trainers cannot see.
    expect(everyone.find((m) => m.fullName === "Esha")?.status).toBe("active");
    expect(
      everyone.every((m) => m.standing === null && m.owedPaise === 0),
    ).toBe(true);
    expect(everyone.find((m) => m.fullName === "Isha")?.nextDue).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// How the two lists were built before: every counted payment loaded into the
// Worker (twice for the sheet), each membership's ledger from its payments
// one by one, and every due date worked out from the first month.

const membershipFields = {
  id: memberships.id,
  memberId: memberships.memberId,
  startsOn: memberships.startsOn,
  billingStartsOn: memberships.billingStartsOn,
  dueChanges: memberships.dueChanges,
  endedOn: memberships.endedOn,
  planId: memberships.planId,
};

function originalPaymentSheet(viewer: Viewer, months: string[]) {
  return withUserContext(t.db, viewer.userId, async (tx) => {
    const [memberRows, membershipRows, paymentRows] = await Promise.all([
      tx.select().from(members).orderBy(asc(members.fullName)),
      tx.select(membershipFields).from(memberships),
      tx
        .select({
          memberId: payments.memberId,
          amountPaise: payments.amountPaise,
          paidOn: payments.paidOn,
        })
        .from(payments)
        .leftJoin(paymentVoids, eq(paymentVoids.paymentId, payments.id))
        .where(isNull(paymentVoids.paymentId))
        .orderBy(desc(payments.paidOn), desc(payments.createdAt)),
    ]);
    const totals = new Map<
      string,
      { last: { amountPaise: number; paidOn: string }; thisMonthPaise: number }
    >();
    for (const { memberId, amountPaise, paidOn } of paymentRows) {
      const entry = totals.get(memberId) ?? {
        last: { amountPaise, paidOn },
        thisMonthPaise: 0,
      };
      if (paidOn.startsWith(thisMonth)) entry.thisMonthPaise += amountPaise;
      totals.set(memberId, entry);
    }
    const { facts, ledgers } = await loadFactsAndLedgers(
      tx,
      membershipRows,
      true,
      today,
    );
    const byMember = new Map<string, MembershipRow[]>();
    for (const row of membershipRows) {
      byMember.set(row.memberId, [...(byMember.get(row.memberId) ?? []), row]);
    }
    return memberRows.flatMap((member) => {
      const rows = byMember.get(member.id) ?? [];
      if (rows.length === 0) return [];
      const withLedgers: MembershipLedger[] = rows.map((row) => ({
        membershipId: row.id,
        startsOn: row.startsOn,
        endedOn: row.endedOn,
        freezes: facts.get(row.id)!.freezes,
        ledger: ledgers.get(row.id)!,
      }));
      const current = rows.find((row) => row.endedOn === null);
      const currentFees = current ? facts.get(current.id)!.fees : null;
      const currentLedger = current ? ledgers.get(current.id)! : null;
      const paid = totals.get(member.id);
      const nextDue =
        currentLedger?.periods.find(
          (period) =>
            period.dueOn >= today && period.paidPaise < period.feePaise,
        )?.dueOn ?? null;
      return [
        {
          memberId: member.id,
          memberCode: member.memberCode,
          fullName: member.fullName,
          phone: member.phone,
          isActive: member.isActive,
          feePaise: currentFees ? feeOn(currentFees, today) : null,
          standing: member.isActive ? (currentLedger?.standing ?? null) : null,
          owedPaise: withLedgers.reduce(
            (sum, entry) => sum + entry.ledger.owedPaise,
            0,
          ),
          lastPayment: paid?.last ?? null,
          paidThisMonthPaise: paid?.thisMonthPaise ?? 0,
          nextDue: member.isActive ? nextDue : null,
          cells: sheetRow(withLedgers, months),
        },
      ];
    });
  });
}

function originalListMembers(viewer: Viewer): Promise<MemberSummary[]> {
  const canSeeFees = can(viewer.role, "payments.viewSheet");
  return withUserContext(t.db, viewer.userId, async (tx) => {
    const [memberRows, openMemberships, visits, paid, settings] =
      await Promise.all([
        tx.select().from(members).orderBy(asc(members.fullName)),
        tx
          .select(membershipFields)
          .from(memberships)
          .where(isNull(memberships.endedOn)),
        tx
          .select({
            memberId: attendance.memberId,
            last: max(attendance.gymDate),
          })
          .from(attendance)
          .groupBy(attendance.memberId),
        tx
          .select({ memberId: payments.memberId, last: max(payments.paidOn) })
          .from(payments)
          .leftJoin(paymentVoids, eq(paymentVoids.paymentId, payments.id))
          .where(isNull(paymentVoids.paymentId))
          .groupBy(payments.memberId),
        tx.select({ days: gymSettings.goneQuietDays }).from(gymSettings),
      ]);
    const { facts, ledgers } = await loadFactsAndLedgers(
      tx,
      openMemberships,
      canSeeFees,
      today,
    );
    const membershipByMember = new Map(
      openMemberships.map((row) => [row.memberId, row]),
    );
    const lastVisit = new Map(visits.map((row) => [row.memberId, row.last]));
    const lastPayment = new Map(paid.map((row) => [row.memberId, row.last]));
    const quietDays = settings[0]?.days ?? 30;
    return memberRows.map((member) => {
      const membership = membershipByMember.get(member.id);
      const fact = membership ? facts.get(membership.id)! : null;
      const status = membershipStatus(member.isActive, fact, today);
      const current = status !== "inactive" && fact;
      const ledger = current ? ledgers.get(membership!.id) : undefined;
      return {
        id: member.id,
        memberCode: member.memberCode,
        fullName: member.fullName,
        phone: member.phone,
        hasAccount: member.profileId !== null,
        status,
        feePaise: current && fact.fees ? feeOn(fact.fees, today) : null,
        nextDue: current && status !== "free" ? nextDueDate(fact, today) : null,
        goneQuiet:
          !!current &&
          status !== "frozen" &&
          isGoneQuiet({
            startsOn: fact.startsOn,
            lastVisit: lastVisit.get(member.id) ?? null,
            lastPayment: lastPayment.get(member.id) ?? null,
            today,
            days: quietDays,
          }),
        standing: ledger?.standing ?? null,
        owedPaise: ledger?.owedPaise ?? 0,
        lastVisit: lastVisit.get(member.id) ?? null,
      };
    });
  });
}
