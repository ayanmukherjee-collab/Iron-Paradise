// The yearly close against the real migrations: old rows summed and gone,
// every balance and due day exactly as before, and nobody but the database
// owner able to run it.
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { memberships, payments } from "@/db/schema";
import {
  createTestDatabase,
  type TestDatabase,
} from "@/db/testing/test-database";
import { withUserContext } from "@/db/user-context";
import { loadFacts, type MembershipRow } from "@/members/facts";
import { buildLedger, type Ledger } from "@/payments/ledger";
import { runYearClose, type YearCloseFiles } from "@/payments/year-close-run";
import { sameLedger } from "@/payments/year-close";

const today = "2026-11-18";

let t: TestDatabase;
let owner: string;
let manager: string;
let trainer: string;
let steady: { memberId: string; membershipId: string };
let gappy: { memberId: string; membershipId: string };
let before: Map<string, Ledger>;
let startsBefore: Map<string, string | null>;
let archived: YearCloseFiles | null = null;
let summary: Record<string, unknown>;

function as<T>(userId: string, run: Parameters<typeof withUserContext<T>>[2]) {
  return withUserContext(t.db, userId, run);
}

/** The database's own message: Drizzle wraps it as the error's cause. */
async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const cause = (error as { cause?: { message?: string } }).cause;
    return cause?.message ?? (error as Error).message;
  }
  throw new Error("expected the database to refuse");
}

async function join(startsOn: string) {
  const memberId = await t.createMember();
  const { rows } = await t.client.query<{ id: string }>(
    "insert into public.memberships (member_id, starts_on) values ($1, $2) returning id",
    [memberId, startsOn],
  );
  await t.client.query(
    "insert into public.membership_fees (membership_id, fee_paise, effective_from, set_by) values ($1, 60000, $2, $3)",
    [rows[0].id, startsOn, owner],
  );
  return { memberId, membershipId: rows[0].id };
}

function pay(
  member: { memberId: string; membershipId: string },
  firstPeriod: number,
  amountPaise: number,
  paidOn: string,
) {
  return as(manager, (tx) =>
    tx.insert(payments).values({
      ...member,
      firstPeriod,
      amountPaise,
      method: "cash",
      paidOn,
      recordedBy: manager,
    }),
  );
}

async function visit(memberId: string, gymDate: string) {
  await t.client.query(
    "insert into public.attendance (member_id, gym_date, checked_in_at, method, marked_by) values ($1, $2, $3, 'manual', $4)",
    [memberId, gymDate, `${gymDate}T05:00:00Z`, manager],
  );
}

/** Every membership's ledger and due anchor, read as the owner. */
async function snapshot() {
  const rows: MembershipRow[] = await t.db
    .select({
      id: memberships.id,
      memberId: memberships.memberId,
      startsOn: memberships.startsOn,
      billingStartsOn: memberships.billingStartsOn,
      dueChanges: memberships.dueChanges,
      endedOn: memberships.endedOn,
      planId: memberships.planId,
    })
    .from(memberships);
  const facts = await loadFacts(t.db as never, rows, true, "all");
  const paid = await t.client.query<{
    id: string;
    membership_id: string;
    first_period: number;
    amount_paise: number;
    created_at: Date;
  }>(
    "select p.id, p.membership_id, p.first_period, p.amount_paise, p.created_at from public.payments p where not exists (select 1 from public.payment_voids v where v.payment_id = p.id)",
  );
  const ledgers = new Map<string, Ledger>();
  for (const [id, fact] of facts) {
    ledgers.set(
      id,
      buildLedger(
        { ...fact, fees: fact.fees! },
        paid.rows
          .filter((row) => row.membership_id === id)
          .map((row) => ({
            id: row.id,
            firstPeriod: row.first_period,
            amountPaise: row.amount_paise,
            createdAt: new Date(row.created_at),
          })),
        today,
      ),
    );
  }
  return {
    ledgers,
    starts: new Map(rows.map((row) => [row.id, row.billingStartsOn])),
  };
}

beforeAll(async () => {
  t = await createTestDatabase();
  owner = await t.createUser("owner");
  manager = await t.createUser("manager");
  trainer = await t.createUser("trainer");

  // Pays every month on time: merges into one carried-forward entry.
  steady = await join("2025-01-10");
  await pay(steady, 0, 60000, "2025-01-10");
  await pay(steady, 1, 60000, "2025-02-11");
  await pay(steady, 2, 60000, "2025-03-10");
  await pay(steady, 3, 60000, "2025-04-10");
  await visit(steady.memberId, "2025-02-01");
  await visit(steady.memberId, "2025-03-15");
  await visit(steady.memberId, "2025-05-01");

  // Short in February but paid March: merging would move money, so the
  // close keeps one entry per first period.
  gappy = await join("2025-01-10");
  await pay(gappy, 0, 60000, "2025-01-10");
  await pay(gappy, 1, 20000, "2025-02-11");
  await pay(gappy, 2, 60000, "2025-03-10");

  ({ ledgers: before, starts: startsBefore } = await snapshot());
  const result = await runYearClose(t.db, today, async (files) => {
    archived = files;
  });
  summary = result.summary;
}, 60_000);

describe("the yearly close", () => {
  it("removes everything before the previous 1 April", async () => {
    expect(summary).toMatchObject({
      cutoff: "2025-04-01",
      payments: 6,
      carriedForward: 4,
      visits: 2,
    });
    const left = await t.client.query<{ paid_on: string; carried: boolean }>(
      "select paid_on::text, carried_forward as carried from public.payments order by paid_on, carried_forward",
    );
    expect(left.rows.filter((row) => !row.carried)).toEqual([
      { paid_on: "2025-04-10", carried: false },
    ]);
    const visits = await t.client.query(
      "select gym_date::text from public.attendance",
    );
    expect(visits.rows).toEqual([{ gym_date: "2025-05-01" }]);
  });

  it("leaves every balance, month and due day exactly as it was", async () => {
    const after = await snapshot();
    for (const [id, ledger] of before) {
      expect(sameLedger(after.ledgers.get(id)!, ledger)).toBe(true);
      expect(after.starts.get(id)).toBe(startsBefore.get(id));
    }
    // A payment recorded after the close doesn't move the due day either.
    await pay(steady, 4, 60000, "2026-11-18");
    const later = await snapshot();
    expect(later.starts.get(steady.membershipId)).toBe(
      startsBefore.get(steady.membershipId),
    );
  });

  it("dates carried-forward entries on the first payment and marks them", async () => {
    const carried = await t.client.query<{
      membership_id: string;
      paid_on: string;
      note: string;
    }>(
      "select membership_id, paid_on::text, note from public.payments where carried_forward order by membership_id, first_period",
    );
    const steadyRows = carried.rows.filter(
      (row) => row.membership_id === steady.membershipId,
    );
    expect(steadyRows).toEqual([
      {
        membership_id: steady.membershipId,
        paid_on: "2025-01-10",
        note: "Carried forward: 3 payments before 1 Apr 2025",
      },
    ]);
    expect(
      carried.rows.filter((row) => row.membership_id === gappy.membershipId),
    ).toHaveLength(3);
  });

  it("keeps the monthly and per-member totals", async () => {
    const money = await t.client.query(
      "select month::text, collected_paise::int as collected, payments, cash_paise::int as cash from public.monthly_payment_totals order by month",
    );
    expect(money.rows).toEqual([
      { month: "2025-01-01", collected: 120000, payments: 2, cash: 120000 },
      { month: "2025-02-01", collected: 80000, payments: 2, cash: 80000 },
      { month: "2025-03-01", collected: 120000, payments: 2, cash: 120000 },
    ]);
    const visits = await t.client.query(
      "select month::text, check_ins, members_visited from public.monthly_visit_totals where check_ins > 0 order by month",
    );
    expect(visits.rows).toEqual([
      { month: "2025-02-01", check_ins: 1, members_visited: 1 },
      { month: "2025-03-01", check_ins: 1, members_visited: 1 },
    ]);
    const member = await t.client.query(
      "select visits, last_visit_on::text from public.member_visit_totals where member_id = $1",
      [steady.memberId],
    );
    expect(member.rows).toEqual([{ visits: 2, last_visit_on: "2025-03-15" }]);
    const paid = await t.client.query(
      "select paid_paise::int as paid, payments from public.member_payment_totals where member_id = $1",
      [gappy.memberId],
    );
    expect(paid.rows).toEqual([{ paid: 140000, payments: 3 }]);
  });

  it("doesn't count carried-forward entries as money taken", async () => {
    const result = await t.client.query<{ total: string }>(
      "select public.collected('2025-01-01', '2025-03-31')::text as total",
    );
    expect(result.rows[0].total).toBe("0");
  });

  it("saves the old rows as CSV first", () => {
    expect(archived?.folder).toBe("before-2025-04-01");
    const names = archived?.files.map((file) => file.name);
    expect(names).toEqual(["payments.csv", "check-ins.csv"]);
    const payments = archived!.files[0].csv.trim().split("\n");
    expect(payments).toHaveLength(7); // header + 6 payments
  });

  it("runs once per cut-off", async () => {
    const again = await runYearClose(t.db, today, async () => {
      throw new Error("should not archive twice");
    });
    expect(again.summary).toMatchObject({ skipped: true });
  });

  it("refuses to touch the last twelve months", async () => {
    await expect(
      t.client.query("select private.close_year('2026-01-01', '[]')"),
    ).rejects.toThrow(/twelve months/);
  });

  it("refuses a plan whose money doesn't add up", async () => {
    const { rows } = await t.client.query<{ id: string }>(
      "select id from public.payments where paid_on = '2025-04-10'",
    );
    await t.client.query("delete from public.year_closes");
    await expect(
      t.client.query("select private.close_year('2025-05-01', $1)", [
        JSON.stringify([
          {
            membershipId: steady.membershipId,
            deleteIds: [rows[0].id],
            carry: [{ firstPeriod: 3, amountPaise: 1 }],
          },
        ]),
      ]),
    ).rejects.toThrow(/counted/);
  });

  it("can't be run by anyone signed in", async () => {
    expect(
      await refusal(
        as(owner, (tx) =>
          tx.execute(sql`select private.close_year('2024-01-01', '[]')`),
        ),
      ),
    ).toMatch(/permission denied/);
  });

  it("won't let staff write a carried-forward entry", async () => {
    expect(
      await refusal(
        as(manager, (tx) =>
          tx.insert(payments).values({
            ...steady,
            firstPeriod: 9,
            amountPaise: 100,
            method: "cash",
            paidOn: "2026-11-18",
            recordedBy: manager,
            carriedForward: true,
          }),
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("shows trainers visit totals but not money", async () => {
    const seen = await as(trainer, async (tx) => ({
      visits: await tx.execute(
        sql`select count(*)::int as n from public.member_visit_totals`,
      ),
      money: await tx.execute(
        sql`select count(*)::int as n from public.member_payment_totals`,
      ),
    }));
    const count = (result: unknown) =>
      (result as { rows: { n: number }[] }).rows[0].n;
    expect(count(seen.visits)).toBeGreaterThan(0);
    expect(count(seen.money)).toBe(0);
    const owned = await as(owner, (tx) =>
      tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(eq(memberships.id, steady.membershipId)),
    );
    expect(owned).toHaveLength(1);
  });
});
