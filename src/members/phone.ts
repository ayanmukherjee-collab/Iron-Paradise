// Members give Indian mobile numbers in every format: "98765 43210",
// "+91-98765-43210", "098765 43210". We store the 10-digit number and add
// the country code only where a link needs it.

const indianMobile = /^[6-9]\d{9}$/;

export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return indianMobile.test(digits) ? digits : null;
}

/** "98765 43210" for display. */
export function formatMobile(phone: string): string {
  return phone.length === 10 ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone;
}

/** A wa.me link that opens WhatsApp with the message ready to send. */
export function whatsAppLink(phone: string, message: string): string {
  return `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
}
