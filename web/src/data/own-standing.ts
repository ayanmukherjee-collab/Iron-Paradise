import type { DueChangeRow } from "@/db/schema";
import { todayAtGym } from "@/lib/dates";
import { buildLedger, type LedgerPayment } from "@/payments/ledger";
import { table } from "./db";
import { dataOf } from "./action";

interface MembershipRow {
  id: string;
  starts_on: string;
  billing_starts_on: string | null;
  due_changes: DueChangeRow[];
  ended_on: string | null;
}

interface PaymentRow {
  id: string;
  first_period: number;
  amount_paise: number;
  created_at: string;
  payment_voids: unknown;
}

export interface OwnStanding {
  fullName: string | null;
  /** What they owe right now; 0 without a current membership. */
  owedPaise: number;
}

/**
 * The signed-in member's name and what they owe, worked out on the phone with
 * the same ledger rules the server used (src/payments/ledger.ts). RLS lets a
 * member read only their own member row, membership, fees, freezes and
 * payments.
 */
export async function getOwnStanding(userId: string): Promise<OwnStanding> {
  const [member, membership] = (await Promise.all([
    table("members")
      .select("full_name")
      .eq("profile_id", userId)
      .maybeSingle()
      .then(dataOf<{ full_name: string } | null>),
    table("memberships")
      .select(
        "id, starts_on, billing_starts_on, due_changes, ended_on, members!inner(profile_id)",
      )
      .eq("members.profile_id", userId)
      .is("ended_on", null)
      .maybeSingle()
      .then(dataOf<MembershipRow | null>),
  ])) as [{ full_name: string } | null, MembershipRow | null];
  if (!member || !membership) {
    return { fullName: member?.full_name ?? null, owedPaise: 0 };
  }

  const [fees, freezes, payments] = (await Promise.all([
    table("membership_fees")
      .select("fee_paise, effective_from, created_at")
      .eq("membership_id", membership.id)
      .then(
        dataOf<
          { fee_paise: number; effective_from: string; created_at: string }[]
        >,
      ),
    table("membership_freezes")
      .select("starts_on, ends_on")
      .eq("membership_id", membership.id)
      .then(dataOf<{ starts_on: string; ends_on: string | null }[]>),
    table("payments")
      .select(
        "id, first_period, amount_paise, created_at, payment_voids(payment_id)",
      )
      .eq("membership_id", membership.id)
      .then(dataOf<PaymentRow[]>),
  ])) as [
    { fee_paise: number; effective_from: string; created_at: string }[],
    { starts_on: string; ends_on: string | null }[],
    PaymentRow[],
  ];

  const counted: LedgerPayment[] = payments
    .filter((payment) => !hasRow(payment.payment_voids))
    .map((payment) => ({
      id: payment.id,
      firstPeriod: payment.first_period,
      amountPaise: payment.amount_paise,
      createdAt: new Date(payment.created_at),
    }));

  const ledger = buildLedger(
    {
      startsOn: membership.starts_on,
      billingStartsOn: membership.billing_starts_on ?? membership.starts_on,
      dueChanges: membership.due_changes.map((change) => ({
        fromPeriod: change.from_period,
        dueOn: change.due_on,
      })),
      endedOn: membership.ended_on,
      fees: fees.map((fee) => ({
        feePaise: fee.fee_paise,
        effectiveFrom: fee.effective_from,
        createdAt: new Date(fee.created_at),
      })),
      freezes: freezes.map((freeze) => ({
        startsOn: freeze.starts_on,
        endsOn: freeze.ends_on,
      })),
    },
    counted,
    todayAtGym(),
  );
  return { fullName: member.full_name, owedPaise: ledger.owedPaise };
}

/** An embedded one-to-one row comes back as an object, null, or a list. */
function hasRow(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : value != null;
}
