import "server-only";
import { asc, eq, lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  attendance,
  members,
  paymentVoids,
  payments,
  profiles,
} from "@/db/schema";
import type { Database } from "@/db/user-context";
import { formatDateTime, type IsoDate } from "@/lib/dates";
import { ledgerTable, toCsv } from "@/payments/export";
import {
  planCarries,
  yearCloseCutoff,
  type ClosePayment,
} from "@/payments/year-close";

export interface YearCloseFiles {
  /** Folder name, e.g. "before-2027-04-01". */
  folder: string;
  files: { name: string; csv: string }[];
}

export interface YearCloseResult {
  cutoff: IsoDate;
  summary: Record<string, unknown>;
  merged: number;
  perPeriod: number;
}

/**
 * The yearly close, start to finish, as the database owner: plan each
 * membership's carried-forward entries (one per unbroken run of paid
 * months), hand the old
 * rows to `archive` (which must succeed), then let private.close_year check
 * the plan, write the totals and delete, in the same transaction.
 */
export async function runYearClose(
  db: Database,
  today: IsoDate,
  archive: (files: YearCloseFiles) => Promise<void>,
): Promise<YearCloseResult> {
  const cutoff = yearCloseCutoff(today);
  return db.transaction(async (tx) => {
    const closed = rowsOf<{ cutoff: string }>(
      await tx.execute(
        sql`select cutoff::text from public.year_closes where cutoff >= ${cutoff}::date limit 1`,
      ),
    );
    if (closed.length) {
      return {
        cutoff,
        summary: { skipped: true, closedBefore: closed[0].cutoff },
        merged: 0,
        perPeriod: 0,
      };
    }

    const paymentRows = await tx
      .select({
        id: payments.id,
        membershipId: payments.membershipId,
        firstPeriod: payments.firstPeriod,
        months: payments.months,
        amountPaise: payments.amountPaise,
        paidOn: payments.paidOn,
        createdAt: payments.createdAt,
        replacesPaymentId: payments.replacesPaymentId,
        voidedAt: paymentVoids.voidedAt,
      })
      .from(payments)
      .leftJoin(paymentVoids, eq(paymentVoids.paymentId, payments.id));
    const closePayments: ClosePayment[] = paymentRows.map((row) => ({
      id: row.id,
      membershipId: row.membershipId,
      firstPeriod: row.firstPeriod,
      months: row.months,
      amountPaise: row.amountPaise,
      paidOn: row.paidOn,
      createdAt: row.createdAt,
      voided: row.voidedAt !== null,
      replacesPaymentId: row.replacesPaymentId,
    }));
    const plans = planCarries(closePayments, cutoff);

    // The full detail of what's about to go, saved first.
    const files = await archiveFiles(tx, cutoff);
    if (files.files.length) await archive(files);

    const result = rowsOf<{ summary: Record<string, unknown> }>(
      await tx.execute(
        sql`select private.close_year(${cutoff}::date, ${JSON.stringify(plans)}::jsonb) as summary`,
      ),
    );
    return {
      cutoff,
      summary: result[0].summary,
      merged: plans.filter((plan) => plan.carry.length === 1).length,
      perPeriod: plans.filter((plan) => plan.carry.length > 1).length,
    };
  });
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Old payments (voided ones marked) and old check-ins, as CSV files. */
async function archiveFiles(tx: Tx, cutoff: IsoDate): Promise<YearCloseFiles> {
  const oldPayments = await tx
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
    .leftJoin(profiles, eq(profiles.id, payments.recordedBy))
    .leftJoin(paymentVoids, eq(paymentVoids.paymentId, payments.id))
    .where(lt(payments.paidOn, cutoff))
    .orderBy(asc(payments.paidOn), asc(payments.createdAt));

  const oldVisits = await tx
    .select({
      gymDate: attendance.gymDate,
      checkedInAt: attendance.checkedInAt,
      method: attendance.method,
      memberCode: members.memberCode,
      fullName: members.fullName,
    })
    .from(attendance)
    .innerJoin(members, eq(members.id, attendance.memberId))
    .where(lt(attendance.gymDate, cutoff))
    .orderBy(asc(attendance.gymDate), asc(attendance.checkedInAt));

  const files: YearCloseFiles["files"] = [];
  if (oldPayments.length) {
    files.push({ name: "payments.csv", csv: toCsv(ledgerTable(oldPayments)) });
  }
  if (oldVisits.length) {
    files.push({
      name: "check-ins.csv",
      csv: toCsv([
        ["Day", "Checked in", "Member ID", "Name", "How"],
        ...oldVisits.map((visit) => [
          visit.gymDate,
          formatDateTime(visit.checkedInAt),
          visit.memberCode,
          visit.fullName,
          visit.method === "qr" ? "Scanned QR" : "Marked by staff",
        ]),
      ]),
    });
  }
  return { folder: `before-${cutoff}`, files };
}

/** postgres-js returns rows; PGlite returns { rows }. */
function rowsOf<T>(result: unknown): T[] {
  return (
    Array.isArray(result) ? result : (result as { rows: T[] }).rows
  ) as T[];
}
