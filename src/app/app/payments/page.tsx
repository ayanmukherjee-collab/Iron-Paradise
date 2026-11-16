import type { Metadata } from "next";
import { requirePermission } from "@/auth/session";
import { StatusCard } from "@/components/ui/status-card";
import { formatMonth, todayAtGym } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { ExportMenu } from "@/payments/components/export-menu";
import { PaymentSheet } from "@/payments/components/payment-sheet";
import { getPaymentSheet } from "@/payments/queries";
import { sheetMonths } from "@/payments/sheet";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const viewer = await requirePermission("payments.viewSheet", "/app/payments");
  const today = todayAtGym();
  const rows = await getPaymentSheet(viewer, sheetMonths(null, today));

  const collected = rows.reduce((sum, row) => sum + row.paidThisMonthPaise, 0);
  const outstanding = rows.reduce((sum, row) => sum + row.owedPaise, 0);
  const owing = rows.filter((row) => row.owedPaise > 0).length;
  const paying = rows.filter(
    (row) => row.isActive && row.standing && row.standing !== "free",
  ).length;

  return (
    <section>
      <header className="flex items-center justify-between gap-3">
        <h1 className="page-title">Payments</h1>
        <ExportMenu />
      </header>

      <div className="mt-5">
        <StatusCard
          title={`This month · ${formatMonth(today.slice(0, 7))}`}
          figures={[
            {
              label: "Outstanding",
              value: formatPaise(outstanding),
              note:
                owing === 0
                  ? "Nobody owes"
                  : `${owing} ${owing === 1 ? "member" : "members"}`,
            },
            { label: "Collected", value: formatPaise(collected) },
            { label: "Paying members", value: String(paying) },
          ]}
        />
      </div>

      <div className="mt-4">
        <PaymentSheet rows={rows} today={today} />
      </div>
    </section>
  );
}
