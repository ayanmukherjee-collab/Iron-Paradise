"use client";

import { Field, inputClass } from "@/components/ui/field";

/**
 * Start date and agreed monthly fee (brief §4.2). Plans only say how long a
 * payment is for, so the fee is always typed in: nothing is assumed.
 */
export function NewMembershipFields({ today }: { today: string }) {
  return (
    <>
      <Field
        label="Start date"
        hint="Fees then fall due monthly on the day of the first payment."
      >
        <input
          name="startsOn"
          type="date"
          required
          defaultValue={today}
          className={inputClass}
        />
      </Field>
      <Field
        label="Agreed monthly fee (₹)"
        hint="What this person actually pays. Use 0 for a free member."
      >
        <input
          name="fee"
          inputMode="decimal"
          required
          placeholder="e.g. 600"
          className={inputClass}
        />
      </Field>
    </>
  );
}
