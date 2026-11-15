import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/auth/session";
import { todayAtGym } from "@/lib/dates";
import { PaymentSheet } from "@/payments/components/payment-sheet";
import { getPaymentSheet } from "@/payments/queries";
import {
  latestSheetMonth,
  shiftMonth,
  sheetMonthCount,
  sheetMonths,
} from "@/payments/sheet";

export const metadata: Metadata = { title: "Payments" };

const linkClass =
  "inline-flex min-h-10 items-center border-2 border-ink bg-white px-3 text-sm font-semibold hover:bg-ink hover:text-white";

export default async function PaymentsPage({
  searchParams,
}: PageProps<"/app/payments">) {
  const viewer = await requirePermission("payments.viewSheet", "/app/payments");
  const { to } = await searchParams;
  const today = todayAtGym();
  const months = sheetMonths(typeof to === "string" ? to : null, today);
  const rows = await getPaymentSheet(viewer, months);

  const last = months.at(-1)!;
  const latest = latestSheetMonth(today);
  const later = shiftMonth(last, sheetMonthCount);
  const exportQuery = `to=${last}`;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-5xl">Payments</h1>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/app/payments/export?format=csv&${exportQuery}`}
            className={linkClass}
          >
            Sheet CSV
          </a>
          <a
            href={`/app/payments/export?format=xlsx&${exportQuery}`}
            className={linkClass}
          >
            Excel
          </a>
          <a href="/app/payments/export?format=ledger" className={linkClass}>
            All payments CSV
          </a>
        </div>
      </div>

      <nav
        aria-label="Months shown"
        className="mt-6 flex items-center justify-between gap-4"
      >
        <Link
          href={{ query: { to: shiftMonth(last, -sheetMonthCount) } }}
          className={linkClass}
        >
          ← Earlier
        </Link>
        {last < latest ? (
          <Link
            href={{ query: { to: later < latest ? later : latest } }}
            className={linkClass}
          >
            Later →
          </Link>
        ) : (
          <span aria-hidden="true" className="w-20" />
        )}
      </nav>

      <div className="mt-6">
        <PaymentSheet rows={rows} months={months} />
      </div>
    </section>
  );
}
