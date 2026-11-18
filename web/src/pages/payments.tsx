// Mirrors src/app/app/payments/page.tsx.
import { todayAtGym } from "@/lib/dates";
import { ExportMenu } from "@/payments/components/export-menu";
import {
  MoneyCards,
  shortMonth,
  type MoneyFigures,
} from "@/payments/components/money-cards";
import { PaymentSheet } from "@/payments/components/payment-sheet";
import { getPaymentSheet, type SheetRow } from "../data/payments";
import { Loaded, useLoad, useTitle } from "../data/use-load";

export function PaymentsPage() {
  useTitle("Payments");
  // No month columns: this list never shows them (only the export does).
  const state = useLoad(() => getPaymentSheet([]), [], "payments");
  return (
    <Loaded state={state}>{(rows) => <PaymentsView rows={rows} />}</Loaded>
  );
}

function PaymentsView({ rows }: { rows: SheetRow[] }) {
  const today = todayAtGym();
  const thisMonth = today.slice(0, 7);
  // Removed members drop out of dues; what they still owe stays on their row.
  const current = rows.filter((row) => row.isActive);
  const figures: MoneyFigures = {
    outstandingPaise: current.reduce((sum, row) => sum + row.owedPaise, 0),
    owing: current.filter((row) => row.owedPaise > 0).length,
    paying: current.filter((row) => row.standing && row.standing !== "free")
      .length,
    overdue: current.filter((row) => row.standing === "overdue").length,
    collectedPaise: rows.reduce((sum, row) => sum + row.paidThisMonthPaise, 0),
  };

  return (
    <section>
      <header className="page-header flex items-center justify-between gap-3">
        <h1 className="page-title">Payments</h1>
        <ExportMenu />
      </header>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 [&>*:first-child]:col-span-2 lg:[&>*:first-child]:col-span-1">
        <MoneyCards
          figures={figures}
          monthLabel={shortMonth(thisMonth)}
          links={false}
        />
      </div>

      <div className="mt-4">
        <PaymentSheet rows={rows} today={today} />
      </div>
    </section>
  );
}
