import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  sum,
} from "drizzle-orm";
import type { Viewer } from "@/auth/session";
import { getDb } from "@/db/client";
import {
  members,
  memberships,
  paymentVoids,
  payments,
  profiles,
} from "@/db/schema";
import { withUserContext, type UserTransaction } from "@/db/user-context";
import { todayAtGym, type IsoDate } from "@/lib/dates";
import { feeOn, type MembershipFacts } from "@/members/billing";
import { loadFacts, type MembershipRow } from "@/members/facts";
import {
  buildLedger,
  payablePeriods,
  type Ledger,
  type LedgerPayment,
  type MembershipWithFees,
  type PeriodState,
  type Standing,
} from "@/payments/ledger";
import {
  sheetRow,
  type MembershipLedger,
  type MonthKey,
  type SheetCell,
} from "@/payments/sheet";

const membershipFields = {
  id: memberships.id,
  memberId: memberships.memberId,
  startsOn: memberships.startsOn,
  endedOn: memberships.endedOn,
  planId: memberships.planId,
};

function withFees(facts: MembershipFacts): MembershipWithFees | null {
  return facts.fees ? { ...facts, fees: facts.fees } : null;
}

/** Payments that still count: every ledger row that has not been voided. */
async function countedPayments(
  tx: UserTransaction,
  membershipIds: string[],
): Promise<Map<string, LedgerPayment[]>> {
  const rows = membershipIds.length
    ? await tx
        .select({
          id: payments.id,
          membershipId: payments.membershipId,
          firstPeriod: payments.firstPeriod,
          amountPaise: payments.amountPaise,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .leftJoin(paymentVoids, eq(paymentVoids.paymentId, payments.id))
        .where(
          and(
            inArray(payments.membershipId, membershipIds),
            isNull(paymentVoids.paymentId),
          ),
        )
    : [];

  const byMembership = new Map<string, LedgerPayment[]>();
  for (const { membershipId, ...payment } of rows) {
    const list = byMembership.get(membershipId) ?? [];
    list.push(payment);
    byMembership.set(membershipId, list);
  }
  return byMembership;
}

/**
 * The ledger of each membership the viewer can see fees for, keyed by
 * membership id, from facts and counted payments already loaded.
 */
function buildLedgers(
  facts: Map<string, MembershipFacts>,
  paid: Map<string, LedgerPayment[]>,
  today: IsoDate,
): Map<string, Ledger> {
  const ledgers = new Map<string, Ledger>();
  for (const [id, fact] of facts) {
    const membership = withFees(fact);
    if (membership)
      ledgers.set(id, buildLedger(membership, paid.get(id) ?? [], today));
  }
  return ledgers;
}

/**
 * Facts and ledgers for a set of memberships. Fees, freezes and payments are
 * fetched side by side in one round trip, not one after another. Viewers who
 * cannot see fees (trainers) get no ledgers, and no payments are fetched.
 */
export async function loadFactsAndLedgers(
  tx: UserTransaction,
  rows: MembershipRow[],
  canSeeFees: boolean,
  today: IsoDate,
): Promise<{
  facts: Map<string, MembershipFacts>;
  ledgers: Map<string, Ledger>;
}> {
  const [facts, paid] = await Promise.all([
    loadFacts(tx, rows, canSeeFees),
    canSeeFees
      ? countedPayments(
          tx,
          rows.map((row) => row.id),
        )
      : new Map<string, LedgerPayment[]>(),
  ]);
  return { facts, ledgers: buildLedgers(facts, paid, today) };
}

export interface SheetRow {
  memberId: string;
  memberCode: string;
  fullName: string;
  phone: string;
  isActive: boolean;
  /** Agreed fee today, null without a current membership. */
  feePaise: number | null;
  standing: Standing | null;
  owedPaise: number;
  /** Their most recent payment that still counts. */
  lastPayment: { amountPaise: number; paidOn: IsoDate } | null;
  /** Counted payments dated this calendar month. */
  paidThisMonthPaise: number;
  /** The next fee not yet due and not paid in full; null when none is set. */
  nextDue: IsoDate | null;
  cells: Record<MonthKey, SheetCell>;
}

interface PaymentTotals {
  last: { amountPaise: number; paidOn: IsoDate };
  thisMonthPaise: number;
}

/** The payment sheet: one row per member, one cell per month (brief §4.5). */
export async function getPaymentSheet(
  viewer: Viewer,
  months: MonthKey[],
): Promise<SheetRow[]> {
  const today = todayAtGym();
  return withUserContext(getDb(), viewer.userId, async (tx) => {
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

    // Newest first, so the first payment seen for a member is their last.
    const thisMonth = today.slice(0, 7);
    const totals = new Map<string, PaymentTotals>();
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

/**
 * Money taken in a date range: counted (not voided) payments by the day
 * they were paid. One sum in the database, for summary cards.
 */
export async function getCollected(
  viewer: Viewer,
  from: IsoDate,
  to: IsoDate,
): Promise<number> {
  return withUserContext(getDb(), viewer.userId, async (tx) => {
    const [row] = await tx
      .select({ total: sum(payments.amountPaise) })
      .from(payments)
      .leftJoin(paymentVoids, eq(paymentVoids.paymentId, payments.id))
      .where(
        and(
          isNull(paymentVoids.paymentId),
          gte(payments.paidOn, from),
          lte(payments.paidOn, to),
        ),
      );
    return Number(row?.total ?? 0);
  });
}

export interface PaymentEntry {
  id: string;
  amountPaise: number;
  method: "cash" | "upi" | "other";
  paidOn: IsoDate;
  receiptNumber: string | null;
  note: string | null;
  recordedAt: Date;
  recordedBy: string | null;
  replacesPaymentId: string | null;
  void: { reason: string; voidedAt: Date } | null;
  /** Due dates this payment went towards; null when voided or credit only. */
  covers: { from: IsoDate; to: IsoDate } | null;
}

export interface MemberPayments {
  ledger: Ledger | null;
  history: PaymentEntry[];
}

/** One member's ledger and payment history, newest first. */
export async function getMemberPayments(
  viewer: Viewer,
  memberId: string,
): Promise<MemberPayments> {
  const today = todayAtGym();
  return withUserContext(getDb(), viewer.userId, async (tx) => {
    const [membershipRows, rows] = await Promise.all([
      tx
        .select(membershipFields)
        .from(memberships)
        .where(eq(memberships.memberId, memberId)),
      tx
        .select({
          id: payments.id,
          membershipId: payments.membershipId,
          amountPaise: payments.amountPaise,
          method: payments.method,
          paidOn: payments.paidOn,
          receiptNumber: payments.receiptNumber,
          note: payments.note,
          recordedAt: payments.createdAt,
          recordedBy: profiles.fullName,
          replacesPaymentId: payments.replacesPaymentId,
          voidReason: paymentVoids.reason,
          voidedAt: paymentVoids.voidedAt,
        })
        .from(payments)
        .leftJoin(paymentVoids, eq(paymentVoids.paymentId, payments.id))
        .leftJoin(profiles, eq(profiles.id, payments.recordedBy))
        .where(eq(payments.memberId, memberId))
        .orderBy(desc(payments.paidOn), desc(payments.createdAt)),
    ]);
    const { ledgers } = await loadFactsAndLedgers(
      tx,
      membershipRows,
      true,
      today,
    );

    const current = membershipRows.find((row) => row.endedOn === null);
    return {
      ledger: current ? (ledgers.get(current.id) ?? null) : null,
      history: rows.map(({ membershipId, voidReason, voidedAt, ...row }) => {
        const span = ledgers.get(membershipId)?.coverage.get(row.id);
        return {
          ...row,
          void:
            voidReason && voidedAt ? { reason: voidReason, voidedAt } : null,
          covers: span ? { from: span.first.dueOn, to: span.last.dueOn } : null,
        };
      }),
    };
  });
}

export interface PaymentFormData {
  member: { id: string; memberCode: string; fullName: string };
  membershipId: string;
  feePaise: number;
  owedPaise: number;
  periods: PeriodState[];
}

/** What the record-payment form offers for a member's current membership. */
export async function getPaymentForm(
  viewer: Viewer,
  memberId: string,
): Promise<PaymentFormData | null> {
  const today = todayAtGym();
  return withUserContext(getDb(), viewer.userId, async (tx) => {
    const [[member], [current]] = await Promise.all([
      tx
        .select({
          id: members.id,
          memberCode: members.memberCode,
          fullName: members.fullName,
        })
        .from(members)
        .where(eq(members.id, memberId)),
      tx
        .select(membershipFields)
        .from(memberships)
        .where(
          and(eq(memberships.memberId, memberId), isNull(memberships.endedOn)),
        ),
    ]);
    if (!member || !current) return null;

    const [facts, counted] = await Promise.all([
      loadFacts(tx, [current], true),
      countedPayments(tx, [current.id]),
    ]);
    const membership = withFees(facts.get(current.id)!);
    if (!membership) return null;
    const paid = counted.get(current.id);
    const ledger = buildLedger(membership, paid ?? [], today);

    return {
      member,
      membershipId: current.id,
      feePaise: feeOn(membership.fees, today) ?? 0,
      owedPaise: ledger.owedPaise,
      periods: payablePeriods(membership, paid ?? [], today),
    };
  });
}

/** Ledger for one membership inside an action's transaction. */
export async function ledgerInTransaction(
  tx: UserTransaction,
  membershipId: string,
  today: IsoDate,
): Promise<{ ledger: Ledger; memberId: string; endedOn: IsoDate | null }> {
  const [row] = await tx
    .select(membershipFields)
    .from(memberships)
    .where(eq(memberships.id, membershipId));
  if (!row) throw new MembershipNotFoundError();
  const { ledgers } = await loadFactsAndLedgers(tx, [row], true, today);
  const ledger = ledgers.get(row.id);
  if (!ledger) throw new MembershipNotFoundError();
  return { ledger, memberId: row.memberId, endedOn: row.endedOn };
}

export interface LedgerExportRow {
  paidOn: IsoDate;
  memberCode: string;
  fullName: string;
  amountPaise: number;
  method: string;
  receiptNumber: string | null;
  note: string | null;
  recordedBy: string | null;
  recordedAt: Date;
  voidReason: string | null;
}

/** Every ledger row, voided ones included and marked, for export. */
export async function listLedgerForExport(
  viewer: Viewer,
): Promise<LedgerExportRow[]> {
  return withUserContext(getDb(), viewer.userId, (tx) =>
    tx
      .select({
        paidOn: payments.paidOn,
        memberCode: members.memberCode,
        fullName: members.fullName,
        amountPaise: payments.amountPaise,
        method: payments.method,
        receiptNumber: payments.receiptNumber,
        note: payments.note,
        recordedBy: profiles.fullName,
        recordedAt: payments.createdAt,
        voidReason: paymentVoids.reason,
      })
      .from(payments)
      .innerJoin(members, eq(members.id, payments.memberId))
      .leftJoin(paymentVoids, eq(paymentVoids.paymentId, payments.id))
      .leftJoin(profiles, eq(profiles.id, payments.recordedBy))
      .orderBy(asc(payments.paidOn), asc(payments.createdAt)),
  );
}

class MembershipNotFoundError extends Error {
  code = "P0002";
  constructor() {
    super("That membership no longer exists.");
  }
}
