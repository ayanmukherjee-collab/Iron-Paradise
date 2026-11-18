// The yearly close (supabase/migrations/*_year_close.sql): which payments go
// and what replaces them. Pure, so the rule can be tested exhaustively.
//
// A membership's dues come from every payment since it began, so old
// payments can only go if something keeps the months they paid for. Each
// payment pays for a run of months; the old payments' runs are merged into
// unbroken stretches, and each stretch becomes one carried-forward entry
// for exactly those months, holding the money of the payments inside it.
// The same months stay paid, so every ledger comes out the same.
import type { IsoDate } from "@/lib/dates";
import type { Ledger } from "@/payments/ledger";

/** The financial year starts on 1 April. */
const yearStartMonth = 4;

/**
 * Everything before this day is summed up and deleted. It is the start of
 * the previous financial year, so at least twelve months (and up to two
 * years) of detail always remain: run on 1 April 2028, it is 1 April 2027.
 */
export function yearCloseCutoff(today: IsoDate): IsoDate {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const thisYearStart = month >= yearStartMonth ? year : year - 1;
  return `${thisYearStart - 1}-0${yearStartMonth}-01`;
}

/** The next close after `today`, and the cut-off it will use. */
export function nextYearClose(today: IsoDate): {
  on: IsoDate;
  cutoff: IsoDate;
} {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const nextYear = month >= yearStartMonth ? year + 1 : year;
  const on = `${nextYear}-0${yearStartMonth}-01`;
  return { on, cutoff: yearCloseCutoff(on) };
}

export interface ClosePayment {
  id: string;
  membershipId: string;
  firstPeriod: number;
  months: number;
  amountPaise: number;
  paidOn: IsoDate;
  createdAt: Date;
  voided: boolean;
  replacesPaymentId: string | null;
}

export interface CarryPlan {
  membershipId: string;
  /** Every payment (counted or voided) the close deletes. */
  deleteIds: string[];
  /** What replaces the counted ones; empty when all of them were voided. */
  carry: CarryEntry[];
}

export interface CarryEntry {
  firstPeriod: number;
  months: number;
  amountPaise: number;
}

/** The plan for every membership with payments dated before `cutoff`. */
export function planCarries(
  payments: ClosePayment[],
  cutoff: IsoDate,
): CarryPlan[] {
  const byMembership = new Map<string, ClosePayment[]>();
  for (const payment of payments) {
    const list = byMembership.get(payment.membershipId);
    if (list) list.push(payment);
    else byMembership.set(payment.membershipId, [payment]);
  }

  const plans: CarryPlan[] = [];
  for (const [membershipId, all] of byMembership) {
    const old = all.filter((payment) => payment.paidOn < cutoff);
    if (old.length === 0) continue;

    // A correction that stays points at the payment it replaced; that one
    // (always voided) stays too, and so on down the chain, so every link
    // holds.
    const byId = new Map(all.map((payment) => [payment.id, payment]));
    const staying = new Set(
      all.filter((payment) => payment.paidOn >= cutoff).map((p) => p.id),
    );
    for (const id of [...staying]) {
      let replaced = byId.get(id)?.replacesPaymentId ?? null;
      while (replaced && !staying.has(replaced)) {
        staying.add(replaced);
        replaced = byId.get(replaced)?.replacesPaymentId ?? null;
      }
    }
    const leaving = old.filter((payment) => !staying.has(payment.id));
    if (leaving.length === 0) continue;
    const countedLeaving = leaving.filter((payment) => !payment.voided);

    plans.push({
      membershipId,
      deleteIds: leaving.map((payment) => payment.id),
      carry: stretches(countedLeaving),
    });
  }
  return plans;
}

/**
 * The payments' months merged into unbroken stretches, oldest first, each
 * with the money of the payments that start in it. Every payment's months
 * fall inside one stretch, so the money adds up exactly.
 */
export function stretches(paid: ClosePayment[]): CarryEntry[] {
  const ordered = [...paid].sort(
    (a, b) => a.firstPeriod - b.firstPeriod || b.months - a.months,
  );
  const out: CarryEntry[] = [];
  for (const payment of ordered) {
    const last = out.at(-1);
    const end = payment.firstPeriod + payment.months;
    if (last && payment.firstPeriod <= last.firstPeriod + last.months) {
      last.months = Math.max(last.months, end - last.firstPeriod);
      last.amountPaise += payment.amountPaise;
    } else {
      out.push({
        firstPeriod: payment.firstPeriod,
        months: payment.months,
        amountPaise: payment.amountPaise,
      });
    }
  }
  return out;
}

/** Same months, same fees, same paid months, same balance: coverage aside. */
export function sameLedger(a: Ledger, b: Ledger): boolean {
  if (
    a.owedPaise !== b.owedPaise ||
    a.creditMonths !== b.creditMonths ||
    a.standing !== b.standing ||
    a.periods.length !== b.periods.length
  ) {
    return false;
  }
  return a.periods.every((period, i) => {
    const other = b.periods[i];
    return (
      period.index === other.index &&
      period.dueOn === other.dueOn &&
      period.feePaise === other.feePaise &&
      period.paidPaise === other.paidPaise &&
      period.status === other.status
    );
  });
}
