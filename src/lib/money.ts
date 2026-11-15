const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const rupeesWithPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats integer paise as Indian rupees, dropping ".00" for whole amounts. */
export function formatPaise(paise: number): string {
  if (!Number.isInteger(paise)) {
    throw new TypeError(`Money must be integer paise, got ${paise}`);
  }
  const formatter = paise % 100 === 0 ? rupees : rupeesWithPaise;
  return formatter.format(paise / 100);
}

const rupeeInput = /^(\d{1,7})(?:\.(\d{1,2}))?$/;

/**
 * Reads a rupee amount typed by staff ("600", "600.5", "₹1,200") as integer
 * paise. Returns null for anything that is not a plain amount. Parsing the
 * digits as text avoids floating-point rounding (0.1 + 0.2).
 */
export function parseRupees(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, "");
  const match = rupeeInput.exec(cleaned);
  if (!match) return null;
  const paise = (match[2] ?? "").padEnd(2, "0");
  return Number(match[1]) * 100 + Number(paise);
}

/** Paise as a plain number for an input field: 60000 → "600", 60050 → "600.50". */
export function paiseToInput(paise: number): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}
