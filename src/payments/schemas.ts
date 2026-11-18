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

/** First payment only: when dues start. Any date; blank follows paidOn. */
export const duesFrom = z
  .union([z.literal(""), isoDate])
  .optional()
  .transform((value) => value || null);

/** How many months a payment pays for: one of the plans (1 to 24). */
export const months = z.coerce
  .number("Pick how long this pays for")
  .int("Pick how long this pays for")
  .min(1, "Pick how long this pays for")
  .max(24, "Pick how long this pays for");

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
