// Zod schemas for payment forms, shared by the server actions that must
// validate every input. Kept out of actions.ts because a "use server" file
// may export only actions.
import { z } from "zod";
import { todayAtGym } from "@/lib/dates";
import { parseRupees } from "@/lib/money";
import { maxPeriods } from "@/members/billing";
import { isoDate } from "@/members/schemas";

const maxAmountPaise = 10_000_000;

/** Rupees received, as integer paise. Must be above zero, unlike a fee. */
export const amountRupees = z.string().transform((value, ctx) => {
  const paise = parseRupees(value);
  if (paise === null || paise === 0) {
    ctx.addIssue({
      code: "custom",
      message: "Enter the amount received in rupees, e.g. 600",
    });
    return z.NEVER;
  }
  if (paise > maxAmountPaise) {
    ctx.addIssue({
      code: "custom",
      message: "That is more than ₹1,00,000. Check the amount.",
    });
    return z.NEVER;
  }
  return paise;
});

export const paymentMethod = z.enum(["cash", "upi", "other"], {
  message: "Pick how they paid",
});

export const paidOn = isoDate.refine(
  (date) => date <= todayAtGym(),
  "The payment date can't be in the future",
);

export const period = z.coerce
  .number("Pick the month this payment starts from")
  .int()
  .min(0)
  .max(maxPeriods - 1);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `Keep the ${label} under ${max} characters`)
    .optional()
    .transform((value) => value || null);

export const receiptNumber = optionalText(40, "receipt number");
export const paymentNote = optionalText(500, "note");

export const voidReason = z
  .string()
  .trim()
  .min(3, "Say why, so the audit log makes sense later")
  .max(500, "Keep the reason under 500 characters");

export const paymentDetails = {
  amount: amountRupees,
  method: paymentMethod,
  paidOn,
  receiptNumber,
  note: paymentNote,
};
