import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { sheetTable, toCsv, toXlsx } from "@/payments/export";
import type { SheetRow } from "@/payments/queries";

const row: SheetRow = {
  memberId: "a",
  memberCode: "IP-0001",
  fullName: 'Asha, "Ash" Rao',
  phone: "9876543210",
  isActive: true,
  feePaise: 60000,
  standing: "overdue",
  owedPaise: 30000,
  lastPayment: { amountPaise: 30000, paidOn: "2026-11-02" },
  paidThisMonthPaise: 30000,
  nextDue: "2026-12-01",
  cells: {
    "2026-10": {
      status: "paid",
      feePaise: 60000,
      paidPaise: 60000,
      target: null,
    },
    "2026-11": {
      status: "partial",
      feePaise: 60000,
      paidPaise: 30000,
      target: { membershipId: "m", period: 1 },
    },
  },
};

describe("sheet export", () => {
  it("writes one column per month in words a person can read", () => {
    const [header, line] = sheetTable([row], ["2026-10", "2026-11"]);
    expect(header.slice(-2)).toEqual(["2026-10", "2026-11"]);
    expect(line).toEqual([
      "IP-0001",
      'Asha, "Ash" Rao',
      "9876543210",
      600,
      "Overdue",
      300,
      "Paid 600",
      "Partial 300 of 600",
    ]);
  });
});

describe("CSV", () => {
  it("quotes commas and quotes, and starts with a byte-order mark", () => {
    const csv = toCsv([["a,b", 'say "hi"', 5]]);
    expect(csv).toBe('\uFEFF"a,b","say ""hi""",5\r\n');
  });

  it("defuses text a spreadsheet would run as a formula", () => {
    const csv = toCsv([['=HYPERLINK("http://x")', "+91", "@sum", "-2"]]);
    expect(csv).toBe(
      '\uFEFF"\'=HYPERLINK(""http://x"")",\'+91,\'@sum,\'-2\r\n',
    );
  });
});

describe("Excel workbook", () => {
  it("contains a worksheet per table with typed cells", () => {
    const files = unzipSync(
      toXlsx([
        {
          name: "Sheet & co",
          table: [
            ["Name", "Fee"],
            ["<b>", 600],
          ],
        },
      ]),
    );
    expect(Object.keys(files).sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
    ]);
    expect(strFromU8(files["xl/workbook.xml"])).toContain(
      'name="Sheet &amp; co"',
    );
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain('<c r="B2"><v>600</v></c>');
    expect(sheet).toContain("&lt;b&gt;");
  });
});
