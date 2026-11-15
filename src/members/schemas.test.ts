import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  checkbox,
  feeRupees,
  mobile,
  optionalNote,
  optionalPlanId,
} from "@/members/schemas";

// The add-member form, exactly as the browser sends it when the gym has not
// created any plans: no planId field at all.
const addMemberForm = z.object({
  phone: mobile,
  fee: feeRupees,
  planId: optionalPlanId,
  consent: checkbox,
});

describe("member form schemas", () => {
  it("accepts a form with no plan field, as sent before any plans exist", () => {
    expect(addMemberForm.parse({ phone: "98765 43210", fee: "600" })).toEqual({
      phone: "9876543210",
      fee: 60000,
      planId: null,
      consent: false,
    });
  });

  it("treats the 'No plan' choice as no plan", () => {
    expect(optionalPlanId.parse("")).toBeNull();
  });

  it("rejects a plan value that is not an id", () => {
    expect(optionalPlanId.safeParse("monthly").success).toBe(false);
  });

  it("turns a blank or missing note into null", () => {
    expect(optionalNote.parse("  ")).toBeNull();
    expect(optionalNote.parse(undefined)).toBeNull();
  });
});
