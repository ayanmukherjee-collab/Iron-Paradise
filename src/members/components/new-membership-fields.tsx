"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui/field";
import { paiseToInput } from "@/lib/money";

export interface PlanOption {
  id: string;
  name: string;
  defaultFeePaise: number;
}

/**
 * Start date, plan and agreed fee. Picking a plan fills in its default fee,
 * which staff then adjust to whatever was agreed (brief §4.2).
 */
export function NewMembershipFields({
  plans,
  today,
}: {
  plans: PlanOption[];
  today: string;
}) {
  const [fee, setFee] = useState(
    plans[0] ? paiseToInput(plans[0].defaultFeePaise) : "",
  );

  return (
    <>
      <Field label="Start date" hint="Fees fall due on this day every month.">
        <input
          name="startsOn"
          type="date"
          required
          defaultValue={today}
          className={inputClass}
        />
      </Field>
      {plans.length > 0 && (
        <Field
          label="Plan"
          hint="Only fills in the usual fee. You can change it below."
        >
          <select
            name="planId"
            defaultValue={plans[0]?.id}
            className={inputClass}
            onChange={(event) => {
              const plan = plans.find(
                (option) => option.id === event.target.value,
              );
              if (plan) setFee(paiseToInput(plan.defaultFeePaise));
            }}
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
            <option value="">No plan</option>
          </select>
        </Field>
      )}
      <Field
        label="Agreed monthly fee (₹)"
        hint="What this person actually pays. Use 0 for a free member."
      >
        <input
          name="fee"
          inputMode="decimal"
          required
          value={fee}
          onChange={(event) => setFee(event.target.value)}
          placeholder="600"
          className={inputClass}
        />
      </Field>
    </>
  );
}
