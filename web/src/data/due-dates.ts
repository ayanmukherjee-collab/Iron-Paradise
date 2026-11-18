import type { DueChangeRow } from "@/db/schema";
import { formatDate, type IsoDate } from "@/lib/dates";
import { dueDate, rescheduled } from "@/members/billing";
import { reschedulablePeriod, type Ledger } from "@/payments/ledger";
import { Refusal } from "./action";
import { loadFactsAndLedgers, membershipRow } from "./ledgers";

/** One membership's ledger, with its member and end date. */
export async function ledgerFor(
  membershipId: string,
  today: IsoDate,
): Promise<{ ledger: Ledger; memberId: string; endedOn: IsoDate | null }> {
  const row = await membershipRow(membershipId);
  if (!row) throw new Refusal("That membership no longer exists.");
  const { ledgers } = await loadFactsAndLedgers([row], true, today);
  const ledger = ledgers.get(row.id);
  if (!ledger) throw new Refusal("That membership no longer exists.");
  return { ledger, memberId: row.memberId, endedOn: row.endedOn };
}

/**
 * Works out a membership's new due_changes, as moveDueDate in
 * src/payments/queries.ts did inside its transaction: the first month not
 * paid in full falls due on `wanted` and every later month follows. With
 * `firstPayment`, period 0 moves instead (dues start on `wanted`). The
 * caller saves the result; the column's check validates its shape.
 */
export async function moveDueDate(
  membershipId: string,
  wanted: IsoDate,
  today: IsoDate,
  { firstPayment = false }: { firstPayment?: boolean } = {},
): Promise<{ period: number; changes: DueChangeRow[] }> {
  const row = await membershipRow(membershipId);
  if (!row) throw new Refusal("That membership no longer exists.");
  if (row.endedOn) {
    throw new Refusal(
      "This membership has ended. Reactivate the member first.",
    );
  }
  const { facts, ledgers } = await loadFactsAndLedgers([row], true, today, {
    coverage: false,
  });
  const fact = facts.get(row.id)!;
  const ledger = ledgers.get(row.id)!;

  let period: number;
  if (firstPayment) {
    if (ledger.creditMonths > 0 || ledger.periods.some((p) => p.paidPaise > 0))
      throw new Refusal("Due from is only for the first payment.");
    period = 0;
  } else {
    period = reschedulablePeriod(ledger, today);
  }

  const changes = rescheduled(fact, period, wanted);
  if (!changes) {
    const previous = period > 0 ? dueDate(fact, period - 1) : null;
    throw new Refusal(
      previous && wanted <= previous
        ? `Pick a day after ${formatDate(previous)}.`
        : dueDate(fact, period) === null
          ? "Frozen with no end date. Unfreeze first."
          : "That day falls in a freeze. Pick another.",
    );
  }
  return {
    period,
    changes: changes.map((change) => ({
      from_period: change.fromPeriod,
      due_on: change.dueOn,
    })),
  };
}
