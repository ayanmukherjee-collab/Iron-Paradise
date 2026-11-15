// CSV and Excel exports of the payment sheet and the ledger (brief §4.5).
// Builds plain tables first, then writes them as CSV text or a minimal
// .xlsx workbook. Kept dependency-light for the Workers bundle limit: the
// workbook is a handful of XML files zipped with fflate.
import { strToU8, zipSync } from "fflate";
import { formatDateTime } from "@/lib/dates";
import { cellLabels, methodLabels, standingLabels } from "@/payments/describe";
import type { LedgerExportRow, SheetRow } from "@/payments/queries";
import type { MonthKey, SheetCell } from "@/payments/sheet";

export type Cell = string | number;
export type Table = Cell[][];

const rupees = (paise: number) => paise / 100;

function cellText(cell: SheetCell): string {
  const label = cellLabels[cell.status];
  switch (cell.status) {
    case "partial":
      return `${label} ${rupees(cell.paidPaise)} of ${rupees(cell.feePaise)}`;
    case "paid":
    case "due":
    case "overdue":
    case "upcoming":
      return `${label} ${rupees(cell.feePaise)}`;
    default:
      return label;
  }
}

/** One row per member, one column per month, as on screen. */
export function sheetTable(rows: SheetRow[], months: MonthKey[]): Table {
  return [
    [
      "Member ID",
      "Name",
      "Phone",
      "Agreed fee (₹)",
      "Standing",
      "Owes (₹)",
      ...months,
    ],
    ...rows.map((row) => [
      row.memberCode,
      row.fullName,
      row.phone,
      row.feePaise === null ? "" : rupees(row.feePaise),
      row.isActive
        ? row.standing
          ? standingLabels[row.standing]
          : ""
        : "Inactive",
      rupees(row.owedPaise),
      ...months.map((month) => cellText(row.cells[month])),
    ]),
  ];
}

/** Every ledger row, oldest first, voided rows included and marked. */
export function ledgerTable(rows: LedgerExportRow[]): Table {
  return [
    [
      "Paid on",
      "Member ID",
      "Name",
      "Amount (₹)",
      "Method",
      "Receipt",
      "Note",
      "Recorded by",
      "Recorded at",
      "Voided because",
    ],
    ...rows.map((row) => [
      row.paidOn,
      row.memberCode,
      row.fullName,
      rupees(row.amountPaise),
      methodLabels[row.method as keyof typeof methodLabels] ?? row.method,
      row.receiptNumber ?? "",
      row.note ?? "",
      row.recordedBy ?? "",
      formatDateTime(row.recordedAt),
      row.voidReason ?? "",
    ]),
  ];
}

// A spreadsheet runs text starting with these as a formula, so a member
// named "=HYPERLINK(...)" could attack whoever opens the export.
const formulaStart = /^[=+\-@\t\r]/;

function csvField(cell: Cell): string {
  if (typeof cell === "number") return String(cell);
  const safe = formulaStart.test(cell) ? `'${cell}` : cell;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV with a byte-order mark so Excel reads ₹ and Indian names correctly. */
export function toCsv(table: Table): string {
  return `\uFEFF${table.map((row) => row.map(csvField).join(",")).join("\r\n")}\r\n`;
}

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

// Strings are written inline, never as formulas, so the injection guard the
// CSV needs does not apply here.
function worksheetXml(table: Table): string {
  const rows = table.map((row, r) => {
    const cells = row.map((cell, c) => {
      const ref = `${columnName(c)}${r + 1}`;
      return typeof cell === "number"
        ? `<c r="${ref}"><v>${cell}</v></c>`
        : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell)}</t></is></c>`;
    });
    return `<row r="${r + 1}">${cells.join("")}</row>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join("")}</sheetData></worksheet>`;
}

/** A minimal .xlsx workbook with one worksheet per entry. */
export function toXlsx(sheets: { name: string; table: Table }[]): Uint8Array {
  const sheetEntries = sheets.map((sheet, i) => ({ ...sheet, id: i + 1 }));
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetEntries
        .map(
          ({ id }) =>
            `<Override PartName="/xl/worksheets/sheet${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join("")}</Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries
        .map(
          ({ id, name }) =>
            `<sheet name="${xmlEscape(name)}" sheetId="${id}" r:id="rId${id}"/>`,
        )
        .join("")}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetEntries
        .map(
          ({ id }) =>
            `<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${id}.xml"/>`,
        )
        .join("")}</Relationships>`,
    ),
  };
  for (const { id, table } of sheetEntries) {
    files[`xl/worksheets/sheet${id}.xml`] = strToU8(worksheetXml(table));
  }
  return zipSync(files, { level: 6 });
}
