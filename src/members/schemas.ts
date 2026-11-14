// Zod schemas for member forms. Shared by the server actions, which must
// validate every input, and kept apart from them because a "use server"
// file may export only actions.
import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { parseRupees } from "@/lib/money";
import { normalizeIndianMobile } from "@/members/phone";

export const fullName = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(120, "Keep the name under 120 characters");

export const mobile = z.string().transform((value, ctx) => {
  const phone = normalizeIndianMobile(value);
  if (!phone) {
    ctx.addIssue({ code: "custom", message: "Enter a 10-digit mobile number" });
    return z.NEVER;
  }
  return phone;
});

export const isoDate = z.string().trim().refine(isIsoDate, "Pick a valid date");

/** Rupees typed by staff, returned as integer paise. Zero is allowed: free members. */
export const feeRupees = z.string().transform((value, ctx) => {
  const paise = parseRupees(value);
  if (paise === null) {
    ctx.addIssue({
      code: "custom",
      message: "Enter the monthly fee in rupees, e.g. 600 (0 for free)",
    });
    return z.NEVER;
  }
  return paise;
});

export const optionalNote = z
  .string()
  .trim()
  .max(200, "Keep the note under 200 characters")
  .transform((value) => value || null)
  .optional()
  .transform((value) => value ?? null);

export const optionalPlanId = z
  .string()
  .transform((value) => value || null)
  .pipe(z.uuid().nullable());

export const checkbox = z
  .string()
  .optional()
  .transform((value) => value === "on" || value === "true");
