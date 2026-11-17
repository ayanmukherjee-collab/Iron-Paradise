import "server-only";
import { and, asc, desc, eq, gte, isNull, lte, sql, sum } from "drizzle-orm";
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
import {
  loadFacts,
  membershipFilter,
  type MembershipRow,
  type MembershipScope,
} from "@/members/facts";
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
  billingStartsOn: memberships.billingStartsOn,
  endedOn: memberships.endedOn,
  planId: memberships.planId,
};

function withFees(facts: MembershipFacts): MembershipWithFees | null {
  return facts.fees ? { ...facts, fees: facts.fees } : null;
}

/** Payments that still count: every ledger row that has not been voided. */
async function countedPayments(
  tx: UserTransaction,
  rows: MembershipRow[],
  scope?: MembershipScope,
): Promise<Map<string, LedgerPayment[]>> {
  const found = rows.length
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
            membershipFilter(payments.membershipId, rows, scope),
            isNull(paymentVoids.paymentId),
          ),
        )
    : [];

  const byMembership = new Map<string, LedgerPayment[]>();
  for (const { membershipId, ...payment } of found) {
    const list = byMembership.get(membershipId);
    if (list) list.push(payment);
    else byMembership.set(membershipId, [payment]);
  }
  return byMembership;
}

// Stands in for each summed payment's id and time; see countedTotals.
const totalRecordedAt = new Date(0);

/**
 * Counted payments summed per membership and first period, each sum standing
 * in for the payments it adds up. A ledger built from these is the same as
 * one built from every payment, except for `coverage` (which payment went
 * towards which months), which comes back keyed by stand-in ids. That holds
 * because the ledger applies payments in first-period order, and payments
 * that start on the same period fill it, and then the months after it, one
 * after another, so their sum fills exactly the same months.
 *
 * Screens that list everyone use this: one row per membership and starting
 * month instead of one per payment ever recorded, and no ids or timestamps
 * for the Worker to parse.
 */
async function countedTotals(
  tx: UserTransaction,
  rows: MembershipRow[],
  scope?: MembershipScope,
): Promise<Map<string, LedgerPayment[]>> {
  const found = rows.length
    ? await tx
        .select({
          membershipId: payments.membershipId,
          firstPeriod: payments.firstPeriod,
          amountPaise: sql<number>`sum(${payments.amountPaise})`.mapWith(
            Number,
          ),
        })
        .from(payments)
        .leftJoin(paymentVoids, eq(paymentVoids.paymentId, payments.id))
        .where(
          and(
            membershipFilter(payments.membershipId, rows, scope),
            isNull(paymentVoids.paymentId),
          ),
        )
        .groupBy(payments.membershipId, payments.firstPeriod)
    : [];

  const byMembership = new Map<string, LedgerPayment[]>();
  for (const { membershipId, firstPeriod, amountPaise } of found) {
    const total: LedgerPayment = {
      id: `from-period-${firstPeriod}`,
      firstPeriod,
      amountPaise,
      createdAt: totalRecordedAt,
    };
    const list = byMembership.get(membershipId);
    if (list) list.push(total);
    else byMembership.set(membershipId, [total]);
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

export interface LedgerOptions {
  /** See MembershipScope: how to filter fees, freezes and payments. */
  scope?: MembershipScope;
  /**
   * Whether ledgers need `coverage` (which payment paid which months). It
   * takes every payment row; without it, payments are summed in the
   * database (see countedTotals). Defaults to true.
   */
  coverage?: boolean;
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
  { scope, coverage = true }: LedgerOptions = {},
): Promise<{
  facts: Map<string, MembershipFacts>;
  ledgers: Map<string, Ledger>;
}> {
  const [facts, paid] = await Promise.all([
    loadFacts(tx, rows, canSeeFees, scope),
    canSeeFees
      ? (coverage ? countedPayments : countedTotals)(tx, rows, scope)
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

/**
 * The payment sheet: one row per member, one cell per month in `months`
 * (brief §4.5). Pass no months when the cells aren't shown; they cost CPU.
 */
export async function getPaymentSheet(
  viewer: Viewer,
  months: MonthKey[],
): Promise<SheetRow[]> {
  const today = todayAtGym();
  const thisMonth = today.slice(0, 7);
  return withUserContext(getDb(), viewer.userId, async (tx) => {
    const [memberRows, membershipRows, paymentRows] = await Promise.all([
      tx
        .select({
          id: members.id,
          memberCode: members.memberCode,
          fullName: members.fullName,
          phone: members.phone,
          isActive: members.isActive,
        })
        .from(members)
        .orderBy(asc(members.fullName)),
      tx.select(membershipFields).from(memberships),
      // Each member's latest counted payment (newest paid_on, then newest
      // recorded) and their counted total this month, worked out in the
      // database: one row per member, rather than every payment ever.
      tx
        .selectDistinctOn([payments.memberId], {
          memberId: payments.memberId,
          amountPaise: payments.amountPaise,
          paidOn: payments.paidOn,
          thisMonthPaise:
            sql<number>`coalesce(sum(${payments.amountPaise}) filter (where to_char(${payments.paidOn}, 'YYYY-MM') = ${thisMonth}) over (partition by ${payments.memberId}), 0)`.mapWith(
              Number,
            ),
        })
        .from(payments)
        .leftJoin(paymentVoids, eq(paymentVoids.paymentId, payments.id))
        .where(isNull(paymentVoids.paymentId))
        .orderBy(
          payments.memberId,
          desc(payments.paidOn),
          desc(payments.createdAt),
        ),
    ]);

    const lastPaid = new Map(paymentRows.map((row) => [row.memberId, row]));
    // Every membership, ended ones too: what someone still owes on an old
    // membership stays on their row.
    const { facts, ledgers } = await loadFactsAndLedgers(
      tx,
      membershipRows,
      true,
      today,
      { scope: "all", coverage: false },
    );

    const byMember = new Map<string, MembershipRow[]>();
    for (const row of membershipRows) {
      const list = byMember.get(row.memberId);
      if (list) list.push(row);
      else byMember.set(row.memberId, [row]);
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
      const paid = lastPaid.get(member.id);
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
          lastPayment: paid
            ? { amountPaise: paid.amountPaise, paidOn: paid.paidOn }
            : null,
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
      countedPayments(tx, [current]),
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
