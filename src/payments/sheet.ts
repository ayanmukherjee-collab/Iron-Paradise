// The payment sheet's grid (brief §4.5): members down the side, calendar
// months across the top. Each cell gathers the periods that fall due in that
// month, computed from the ledger and never stored.
import type { IsoDate } from "@/lib/dates";
import type { Freeze } from "@/members/billing";
import type { Ledger, PeriodStatus } from "@/payments/ledger";

/** "2026-11". */
export type MonthKey = string;

export type CellStatus = PeriodStatus | "frozen" | "none";

export interface SheetCell {
  status: CellStatus;
  feePaise: number;
  paidPaise: number;
  /** Where tapping the cell records a payment; null when nothing is owed. */
  target: { membershipId: string; period: number } | null;
}

export interface MembershipLedger {
  membershipId: string;
  startsOn: IsoDate;
  endedOn: IsoDate | null;
  freezes: Freeze[];
  ledger: Ledger;
}

// When two periods share a month (possible after a freeze), the cell shows
// whichever needs attention most.
const urgency: CellStatus[] = [
  "overdue",
  "due",
  "upcoming",
  "paid",
  "free",
  "frozen",
  "none",
];

export function monthOf(date: IsoDate): MonthKey {
  return date.slice(0, 7);
}

export function shiftMonth(month: MonthKey, by: number): MonthKey {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + by, 1))
    .toISOString()
    .slice(0, 7);
}

/** `count` consecutive months ending with `last`, oldest first. */
export function monthRange(last: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, offset) =>
    shiftMonth(last, offset - count + 1),
  );
}

export const sheetMonthCount = 7;

/** The newest month the sheet can show: next month, for upcoming dues. */
export function latestSheetMonth(today: IsoDate): MonthKey {
  return shiftMonth(monthOf(today), 1);
}

/**
 * The months on screen, ending at `to` when it is a real month no later than
 * the newest allowed, else ending next month.
 */
export function sheetMonths(to: string | null, today: IsoDate): MonthKey[] {
  const latest = latestSheetMonth(today);
  const valid = to !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(to);
  const last = valid && to <= latest ? to : latest;
  return monthRange(last, sheetMonthCount);
}

function lastDayOf(month: MonthKey): IsoDate {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

function frozenDuring(membership: MembershipLedger, month: MonthKey): boolean {
  const first = `${month}-01`;
  const last = lastDayOf(month);
  if (membership.startsOn > last) return false;
  if (membership.endedOn !== null && membership.endedOn < first) return false;
  return membership.freezes.some(
    (freeze) =>
      freeze.startsOn <= last &&
      (freeze.endsOn === null || freeze.endsOn >= first),
  );
}

const emptyCell: SheetCell = {
  status: "none",
  feePaise: 0,
  paidPaise: 0,
  target: null,
};

/** One cell per month for one member, across all their memberships. */
export function sheetRow(
  memberships: MembershipLedger[],
  months: MonthKey[],
): Record<MonthKey, SheetCell> {
  const row: Record<MonthKey, SheetCell> = {};
  for (const month of months) {
    const due = memberships.flatMap((membership) =>
      membership.ledger.periods
        .filter((period) => monthOf(period.dueOn) === month)
        .map((period) => ({ membership, period })),
    );

    if (due.length === 0) {
      const frozen = memberships.some((m) => frozenDuring(m, month));
      row[month] = frozen ? { ...emptyCell, status: "frozen" } : emptyCell;
      continue;
    }

    const status = urgency.find((candidate) =>
      due.some(({ period }) => period.status === candidate),
    )!;
    const open = due.find(({ period }) => period.paidPaise < period.feePaise);
    row[month] = {
      status,
      feePaise: due.reduce((sum, { period }) => sum + period.feePaise, 0),
      paidPaise: due.reduce((sum, { period }) => sum + period.paidPaise, 0),
      target: open
        ? {
            membershipId: open.membership.membershipId,
            period: open.period.index,
          }
        : null,
    };
  }
  return row;
}
