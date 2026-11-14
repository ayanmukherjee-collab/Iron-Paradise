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
