// Browser versions of src/payments/queries.ts: same names, same shapes.
import { todayAtGym, type IsoDate } from "@/lib/dates";
import { dueDate, feeOn } from "@/members/billing";
import {
  buildLedger,
  payablePeriods,
  reschedulablePeriod,
} from "@/payments/ledger";
import type {
  LedgerExportRow,
  MemberPayments,
  PaymentEntry,
  PaymentFormData,
  SheetRow,
} from "@/payments/queries";
import {
  sheetRow,
  type MembershipLedger,
  type MonthKey,
} from "@/payments/sheet";
import { dataOf } from "./action";
import { allRows, date, groupBy, rpc, table } from "./db";
import {
  countedPayments,
  loadFacts,
  loadFactsAndLedgers,
  membershipColumns,
  withFees,
  type MembershipRow,
} from "./ledgers";

export type {
  LedgerExportRow,
  MemberPayments,
  PaymentEntry,
  PaymentFormData,
  SheetRow,
};

/** The payment sheet: one row per member, one cell per month in `months`. */
export async function getPaymentSheet(months: MonthKey[]): Promise<SheetRow[]> {
  const today = todayAtGym();
  const thisMonth = today.slice(0, 7);
  const [memberRows, membershipRows, paymentRows] = await Promise.all([
    allRows(() =>
      table("members")
        .select(
          "id, memberCode:member_code, fullName:full_name, phone, isActive:is_active",
        )
        .order("full_name")
        .order("id"),
    ) as Promise<
      {
        id: string;
        memberCode: string;
        fullName: string;
        phone: string;
        isActive: boolean;
      }[]
    >,
    allRows(() =>
      table("memberships").select(membershipColumns).order("id"),
    ) as Promise<MembershipRow[]>,
    rpc<
      {
        member_id: string;
        amount_paise: number;
        paid_on: IsoDate;
        this_month_paise: number;
      }[]
    >("latest_payments", { this_month: thisMonth }),
  ]);

  const lastPaid = new Map(paymentRows.map((row) => [row.member_id, row]));
  const { facts, ledgers } = await loadFactsAndLedgers(
    membershipRows,
    true,
    today,
    { scope: "all", coverage: false },
  );
  const byMember = groupBy(membershipRows, (row) => row.memberId);

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
        (period) => period.dueOn >= today && period.paidPaise < period.feePaise,
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
          ? { amountPaise: paid.amount_paise, paidOn: paid.paid_on }
          : null,
        paidThisMonthPaise: Number(paid?.this_month_paise ?? 0),
        nextDue: member.isActive ? nextDue : null,
        cells: sheetRow(withLedgers, months),
      },
    ];
  });
}

/** Money taken in a date range, counted payments only. */
export async function getCollected(
  from: IsoDate,
  to: IsoDate,
): Promise<number> {
  return Number(
    await rpc<number | string>("collected", { from_day: from, to_day: to }),
  );
}

/** One member's ledger and payment history, newest first. */
export async function getMemberPayments(
  memberId: string,
): Promise<MemberPayments> {
  const today = todayAtGym();
  const [membershipRows, rows] = await Promise.all([
    table("memberships")
      .select(membershipColumns)
      .eq("member_id", memberId)
      .then(dataOf),
    allRows(() =>
      table("payments")
        .select(
          "id, membershipId:membership_id, amountPaise:amount_paise, method, paidOn:paid_on, receiptNumber:receipt_number, note, recordedAt:created_at, replacesPaymentId:replaces_payment_id, profiles(full_name), payment_voids(reason, voided_at)",
        )
        .eq("member_id", memberId)
        .order("paid_on", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id"),
    ),
  ]);
  const memberships = membershipRows as MembershipRow[];
  const { facts, ledgers } = await loadFactsAndLedgers(
    memberships,
    true,
    today,
  );

  const current = memberships.find((row) => row.endedOn === null);
  const ledger = current ? (ledgers.get(current.id) ?? null) : null;
  const fact = current ? facts.get(current.id) : undefined;
  return {
    ledger,
    dueToMove:
      ledger && fact ? dueDate(fact, reschedulablePeriod(ledger, today)) : null,
    history: (
      rows as {
        id: string;
        membershipId: string;
        amountPaise: number;
        method: PaymentEntry["method"];
        paidOn: IsoDate;
        receiptNumber: string | null;
        note: string | null;
        recordedAt: string;
        replacesPaymentId: string | null;
        profiles: { full_name: string } | null;
        payment_voids:
          | { reason: string; voided_at: string }
          | { reason: string; voided_at: string }[]
          | null;
      }[]
    ).map(({ membershipId, profiles, payment_voids, recordedAt, ...row }) => {
      const span = ledgers.get(membershipId)?.coverage.get(row.id);
      const voided = Array.isArray(payment_voids)
        ? payment_voids[0]
        : payment_voids;
      return {
        ...row,
        recordedAt: date(recordedAt),
        recordedBy: profiles?.full_name ?? null,
        void: voided
          ? { reason: voided.reason, voidedAt: date(voided.voided_at) }
          : null,
        covers: span ? { from: span.first.dueOn, to: span.last.dueOn } : null,
      };
    }),
  };
}

/** What the record-payment form offers for a member's current membership. */
export async function getPaymentForm(
  memberId: string,
): Promise<PaymentFormData | null> {
  const today = todayAtGym();
  const [member, current] = await Promise.all([
    table("members")
      .select("id, memberCode:member_code, fullName:full_name")
      .eq("id", memberId)
      .maybeSingle()
      .then(dataOf),
    table("memberships")
      .select(membershipColumns)
      .eq("member_id", memberId)
      .is("ended_on", null)
      .maybeSingle()
      .then(dataOf),
  ]);
  if (!member || !current) return null;
  const row = current as MembershipRow;

  const [facts, counted] = await Promise.all([
    loadFacts([row], true),
    countedPayments([row]),
  ]);
  const membership = withFees(facts.get(row.id)!);
  if (!membership) return null;
  const paid = counted.get(row.id);
  const ledger = buildLedger(membership, paid ?? [], today);

  return {
    member: member as PaymentFormData["member"],
    membershipId: row.id,
    feePaise: feeOn(membership.fees, today) ?? 0,
    owedPaise: ledger.owedPaise,
    // Two years ahead, so the longest plan (24 months) can be paid in one go.
    periods: payablePeriods(membership, paid ?? [], today, 24),
    firstPayment: !paid?.length && membership.dueChanges.length === 0,
  };
}

/** Every ledger row, voided ones included and marked, for export. */
export async function listLedgerForExport(): Promise<LedgerExportRow[]> {
  const rows = await allRows(() =>
    table("payments")
      .select(
        "paidOn:paid_on, amountPaise:amount_paise, method, receiptNumber:receipt_number, note, recordedAt:created_at, members(member_code, full_name), profiles(full_name), payment_voids(reason)",
      )
      .order("paid_on")
      .order("created_at")
      .order("id"),
  );
  return (
    rows as {
      paidOn: IsoDate;
      amountPaise: number;
      method: string;
      receiptNumber: string | null;
      note: string | null;
      recordedAt: string;
      members: { member_code: string; full_name: string };
      profiles: { full_name: string } | null;
      payment_voids: { reason: string } | { reason: string }[] | null;
    }[]
  ).map(({ members, profiles, payment_voids, recordedAt, ...row }) => {
    const voided = Array.isArray(payment_voids)
      ? payment_voids[0]
      : payment_voids;
    return {
      ...row,
      memberCode: members.member_code,
      fullName: members.full_name,
      recordedBy: profiles?.full_name ?? null,
      recordedAt: date(recordedAt),
      voidReason: voided?.reason ?? null,
    };
  });
}
