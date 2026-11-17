// The old app served these files from Route Handlers on the Worker
// (src/app/app/payments/export, src/app/app/attendance/setup/printed-qr).
// Here the phone builds them from the same data with the same code and
// saves them, then goes back to the page the link was on.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { checkInUrl } from "@/attendance/code";
import { printedQrPdf } from "@/attendance/qr-pdf";
import { gym } from "@/content/landing";
import { formatDate, todayAtGym } from "@/lib/dates";
import { ledgerTable, sheetTable, toCsv, toXlsx } from "@/payments/export";
import { sheetMonths } from "@/payments/sheet";
import { getCheckInSetup } from "../data/attendance";
import { getPaymentSheet, listLedgerForExport } from "../data/payments";
import { useTitle } from "../data/use-load";
import { env } from "../lib/env";

interface File {
  body: BlobPart;
  name: string;
  type: string;
}

function save({ body, name, type }: File) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `iron-paradise-${name}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Builds a file once, saves it, then returns to `back`. */
function Download({
  build,
  back,
}: {
  build: () => Promise<File>;
  back: string;
}) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    build().then(
      (file) => {
        save(file);
        navigate(back, { replace: true });
      },
      (failure: unknown) =>
        setError(
          failure instanceof Error && failure.message
            ? failure.message
            : "Couldn't make the file. Check your connection and try again.",
        ),
    );
  }, [build, back, navigate]);

  return error ? (
    <p role="alert" className="callout">
      {error}
    </p>
  ) : (
    <p role="status" className="page-title">
      Preparing your file…
    </p>
  );
}

const formats = new Set(["csv", "xlsx", "ledger"]);

export function PaymentsExportPage() {
  useTitle("Export");
  const [params] = useSearchParams();
  const format = params.get("format") ?? "csv";
  const to = params.get("to");

  async function build(): Promise<File> {
    if (!formats.has(format)) throw new Error("Unknown export format");
    const today = todayAtGym();
    if (format === "ledger") {
      const table = ledgerTable(await listLedgerForExport());
      return {
        body: toCsv(table),
        name: `payments-ledger-${today}.csv`,
        type: "text/csv;charset=utf-8",
      };
    }
    const months = sheetMonths(to, today);
    const sheet = sheetTable(await getPaymentSheet(months), months);
    const name = `payment-sheet-${months[0]}-to-${months.at(-1)}`;
    if (format === "csv") {
      return {
        body: toCsv(sheet),
        name: `${name}.csv`,
        type: "text/csv;charset=utf-8",
      };
    }
    const ledger = ledgerTable(await listLedgerForExport());
    const workbook = toXlsx([
      { name: "Sheet", table: sheet },
      { name: "Payments", table: ledger },
    ]);
    return {
      body: new Uint8Array(workbook),
      name: `${name}.xlsx`,
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  return <Download build={build} back="/app/payments" />;
}

export function PrintedQrPage() {
  useTitle("Printed QR");

  async function build(): Promise<File> {
    const setup = await getCheckInSetup();
    if (!setup.printedQrEnabled) {
      throw new Error(
        "The printed QR is switched off. Switch it on to download it.",
      );
    }
    const pdf = printedQrPdf({
      url: checkInUrl(setup.printedCode, env.siteUrl),
      gymName: gym.name,
      madeOn: formatDate(todayAtGym()),
    });
    return {
      body: new Uint8Array(pdf),
      name: "check-in-qr.pdf",
      type: "application/pdf",
    };
  }

  return <Download build={build} back="/app/attendance/setup" />;
}
