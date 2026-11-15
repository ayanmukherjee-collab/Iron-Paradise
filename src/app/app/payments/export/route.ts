import { getViewer, viewerCan } from "@/auth/session";
import { todayAtGym } from "@/lib/dates";
import { ledgerTable, sheetTable, toCsv, toXlsx } from "@/payments/export";
import { getPaymentSheet, listLedgerForExport } from "@/payments/queries";
import { sheetMonths } from "@/payments/sheet";

const formats = new Set(["csv", "xlsx", "ledger"]);

// A file download, so a Route Handler rather than a page. It repeats the
// same session and permission checks every Server Action makes.
export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return new Response("Sign in required", { status: 401 });
  if (!viewerCan(viewer, "payments.viewSheet")) {
    return new Response("You don't have access to payments", { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const format = params.get("format") ?? "csv";
  if (!formats.has(format)) {
    return new Response("Unknown export format", { status: 400 });
  }

  const today = todayAtGym();
  if (format === "ledger") {
    const table = ledgerTable(await listLedgerForExport(viewer));
    return download(toCsv(table), `payments-ledger-${today}.csv`, "text/csv");
  }

  const months = sheetMonths(params.get("to"), today);
  const sheet = sheetTable(await getPaymentSheet(viewer, months), months);
  const name = `payment-sheet-${months[0]}-to-${months.at(-1)}`;
  if (format === "csv") {
    return download(toCsv(sheet), `${name}.csv`, "text/csv");
  }

  const ledger = ledgerTable(await listLedgerForExport(viewer));
  const workbook = toXlsx([
    { name: "Sheet", table: sheet },
    { name: "Payments", table: ledger },
  ]);
  return download(
    // Response wants a plain ArrayBuffer-backed view; fflate's type is wider.
    new Uint8Array(workbook),
    `${name}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

function download(
  body: string | Uint8Array<ArrayBuffer>,
  filename: string,
  type: string,
) {
  return new Response(body, {
    headers: {
      "Content-Type": type.startsWith("text/")
        ? `${type}; charset=utf-8`
        : type,
      "Content-Disposition": `attachment; filename="iron-paradise-${filename}"`,
      // Member names and money: never kept by a shared cache or the browser.
      "Cache-Control": "private, no-store",
    },
  });
}
