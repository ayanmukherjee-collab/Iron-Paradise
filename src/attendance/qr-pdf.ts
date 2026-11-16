// The printed check-in QR as a one-page A4 PDF, ready to stick at the desk.
// Written by hand rather than with a PDF library to stay inside the Workers
// bundle limit: the QR is drawn as filled squares (sharp at any print size)
// and the text uses Helvetica, which every PDF reader has built in, so no
// font is embedded. Text must stay plain ASCII for that reason.
import { encode } from "uqr";

const pageWidth = 595.28; // A4 in points
const pageHeight = 841.89;

// Advance widths (per 1000 units) for ASCII 32-126, from the standard AFM
// metrics. Only used to centre lines, so small rounding doesn't matter.
const regularWidths = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];
const boldWidths = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584,
  584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333,
  278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278,
  556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556,
  500, 389, 280, 389, 584,
];

type Font = "regular" | "bold";

function textWidth(text: string, font: Font, size: number): number {
  const widths = font === "bold" ? boldWidths : regularWidths;
  let units = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    units += widths[code - 32] ?? 556;
  }
  return (units / 1000) * size;
}

/** Keeps only printable ASCII, so the built-in fonts can draw every character. */
function ascii(text: string): string {
  return text.replace(/[^\x20-\x7e]/g, "");
}

function pdfString(text: string): string {
  return `(${ascii(text).replace(/[\\()]/g, (char) => `\\${char}`)})`;
}

const n = (value: number) => Number(value.toFixed(2)).toString();

function centredText(
  text: string,
  font: Font,
  size: number,
  y: number,
  gray = 0,
): string {
  const x = (pageWidth - textWidth(ascii(text), font, size)) / 2;
  const name = font === "bold" ? "/F2" : "/F1";
  return `${n(gray)} g BT ${name} ${size} Tf ${n(x)} ${n(y)} Td ${pdfString(text)} Tj ET\n`;
}

export interface PrintedQrSheet {
  /** What the QR opens: the check-in link with the printed code. */
  url: string;
  gymName: string;
  /** "16 Nov 2026", printed small so an old sheet is easy to spot. */
  madeOn: string;
}

/** The PDF file's bytes. */
export function printedQrPdf(sheet: PrintedQrSheet): Uint8Array {
  // A black band with the gym's name across the top.
  let content = `0 g 0 ${n(pageHeight - 96)} ${n(pageWidth)} 96 re f\n`;
  content += centredText(
    sheet.gymName.toUpperCase(),
    "bold",
    22,
    pageHeight - 58,
    1,
  );

  content += centredText("Check in here", "bold", 44, pageHeight - 170);
  content += centredText(
    "Scan this code with the app every time you train.",
    "regular",
    15,
    pageHeight - 200,
    0.35,
  );

  // The QR, centred, with its quiet zone built into the module grid.
  const { data, size } = encode(sheet.url, { ecc: "M", border: 4 });
  const qrSide = 380;
  const cell = qrSide / size;
  const left = (pageWidth - qrSide) / 2;
  const top = pageHeight - 230;
  content += `0 g\n`;
  data.forEach((row, y) => {
    // Runs of dark modules become one rectangle each, keeping the file small.
    let x = 0;
    while (x < size) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < size && row[x]) x += 1;
      content += `${n(left + start * cell)} ${n(top - (y + 1) * cell)} ${n((x - start) * cell)} ${n(cell)} re\n`;
    }
  });
  content += `f\n`;
  // A hairline frame so the sheet can be trimmed straight.
  content += `0.8 G 1 w ${n(left)} ${n(top - qrSide)} ${n(qrSide)} ${n(qrSide)} re S\n`;

  const stepsTop = top - qrSide - 52;
  content += centredText(
    "1. Open the app    2. Tap Check in    3. Scan this code",
    "bold",
    16,
    stepsTop,
  );
  content += centredText(
    "No app yet? Ask at the front desk and we will mark you in.",
    "regular",
    12,
    stepsTop - 26,
    0.35,
  );
  content += centredText(
    `Sheet made ${sheet.madeOn}. If check-in says the code is wrong, ask for a new sheet.`,
    "regular",
    9,
    40,
    0.55,
  );

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(pageWidth)} ${n(pageHeight)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    `<< /Title ${pdfString(`${sheet.gymName} check-in QR`)} /Producer (Iron Paradise) >>`,
  ];

  // Everything above is ASCII, so string length equals byte length and the
  // cross-reference offsets can be counted in characters.
  let file = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(file.length);
    file += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = file.length;
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    file += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return new TextEncoder().encode(file);
}
