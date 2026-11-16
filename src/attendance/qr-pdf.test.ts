import { describe, expect, it } from "vitest";
import { printedQrPdf } from "@/attendance/qr-pdf";

const sheet = {
  url: "https://example.test/app/check-in?code=abc123",
  gymName: "Iron Paradise",
  madeOn: "16 Nov 2026",
};

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("printed QR PDF", () => {
  it("is a one-page PDF with the sheet's text", () => {
    const pdf = text(printedQrPdf(sheet));
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("/Count 1");
    expect(pdf).toContain("(IRON PARADISE)");
    expect(pdf).toContain("(Check in here)");
    expect(pdf).toContain("Sheet made 16 Nov 2026");
  });

  it("points every cross-reference entry at its object", () => {
    const pdf = text(printedQrPdf(sheet));
    const xrefAt = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(xrefAt, xrefAt + 4)).toBe("xref");

    const entries = [...pdf.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)];
    expect(entries).toHaveLength(7);
    entries.forEach(([, offset], index) => {
      expect(pdf.slice(Number(offset)).startsWith(`${index + 1} 0 obj`)).toBe(
        true,
      );
    });
  });

  it("gives the content stream its true length", () => {
    const pdf = text(printedQrPdf(sheet));
    const match = /<< \/Length (\d+) >>\nstream\n/.exec(pdf)!;
    const start = match.index + match[0].length;
    expect(pdf.slice(start + Number(match[1])).startsWith("endstream")).toBe(
      true,
    );
  });

  it("draws the QR and escapes text that would break the file", () => {
    const pdf = text(printedQrPdf({ ...sheet, gymName: "Gym (North) \\ ₹" }));
    expect(pdf).toContain("(GYM \\(NORTH\\) \\\\ )");
    // Dark modules are drawn as filled rectangles.
    expect((pdf.match(/ re\n/g) ?? []).length).toBeGreaterThan(50);
  });
});
