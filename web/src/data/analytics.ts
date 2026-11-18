// The Analytics page's figures: one row per month, summed in the database
// (public.monthly_analytics), so the page fetches twelve small rows.
import { todayAtGym, type IsoDate } from "@/lib/dates";
import { rpc } from "./db";

export interface MonthFigures {
  /** First day of the month, "YYYY-MM-01". */
  month: IsoDate;
  /** Members holding a membership at the end of the month (today, for this month). */
  members: number;
  /** New admissions: members added that month. */
  joined: number;
  checkIns: number;
  membersVisited: number;
  collectedPaise: number;
  payments: number;
  cashPaise: number;
  upiPaise: number;
  otherPaise: number;
  /** Payments voided that month: wrong entries corrected or cancelled. */
  corrections: number;
}

interface MonthRow {
  month: IsoDate;
  members: number;
  joined: number;
  check_ins: number;
  members_visited: number;
  // bigint columns arrive as strings.
  collected_paise: number | string;
  payments: number;
  cash_paise: number | string;
  upi_paise: number | string;
  other_paise: number | string;
  corrections: number;
}

/** The last `months` months, oldest first, ending with this month. */
export async function getMonthlyAnalytics(
  months = 12,
): Promise<MonthFigures[]> {
  const thisMonth = `${todayAtGym().slice(0, 7)}-01`;
  const rows = await rpc<MonthRow[]>("monthly_analytics", {
    last_month: thisMonth,
    months,
  });
  return rows.map((row) => ({
    month: row.month,
    members: row.members,
    joined: row.joined,
    checkIns: row.check_ins,
    membersVisited: row.members_visited,
    collectedPaise: Number(row.collected_paise),
    payments: row.payments,
    cashPaise: Number(row.cash_paise),
    upiPaise: Number(row.upi_paise),
    otherPaise: Number(row.other_paise),
    corrections: row.corrections,
  }));
}
