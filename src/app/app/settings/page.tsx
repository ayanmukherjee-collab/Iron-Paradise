import type { Metadata } from "next";
import { requirePermission } from "@/auth/session";
import { ActionForm } from "@/components/ui/action-form";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import { formatPaise, paiseToInput } from "@/lib/money";
import { saveGoneQuietDays, savePlan } from "@/members/actions";
import { getGoneQuietDays, listPlans } from "@/members/queries";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requirePermission("plans.edit", "/app/settings");
  const [plans, quietDays] = await Promise.all([
    listPlans(viewer),
    getGoneQuietDays(viewer),
  ]);

  return (
    <div className="space-y-12">
      <section>
        <h1 className="display text-5xl">Settings</h1>
      </section>

      <section className="border-t-2 border-ink pt-6">
        <h2 className="display text-3xl">Plans</h2>
        <p className="mt-2 max-w-prose text-lg">
          A plan only fills in the usual fee when someone joins. Each member
          keeps their own agreed fee, so changing a plan here never changes what
          existing members pay.
        </p>

        <ul className="mt-6 space-y-8">
          {plans.map((plan) => (
            <li key={plan.id}>
              <ActionForm
                action={savePlan}
                submitLabel="Save"
                success="Saved."
                variant="outline-dark"
              >
                <input type="hidden" name="planId" value={plan.id} />
                <PlanFields
                  name={plan.name}
                  months={plan.durationMonths}
                  fee={plan.defaultFeePaise}
                />
                <Checkbox
                  name="isActive"
                  label="Offer this plan to new members"
                  defaultChecked={plan.isActive}
                />
              </ActionForm>
            </li>
          ))}
        </ul>

        <ActionForm
          action={savePlan}
          submitLabel="Add plan"
          success="Plan added."
          className="mt-10"
        >
          <h3 className="text-lg font-bold">New plan</h3>
          <input type="hidden" name="planId" value="" />
          <PlanFields name="" months={1} fee={null} />
        </ActionForm>
      </section>

      <section className="border-t-2 border-ink pt-6">
        <h2 className="display text-3xl">Gone quiet</h2>
        <ActionForm
          action={saveGoneQuietDays}
          submitLabel="Save"
          success="Saved."
          className="mt-4 max-w-sm"
        >
          <Field
            label="Days with no visit or payment"
            hint="Members past this show in the Gone quiet list. Nobody is marked inactive automatically."
          >
            <input
              name="days"
              type="number"
              min={7}
              max={180}
              required
              defaultValue={quietDays}
              className={inputClass}
            />
          </Field>
        </ActionForm>
      </section>
    </div>
  );
}

function PlanFields({
  name,
  months,
  fee,
}: {
  name: string;
  months: number;
  fee: number | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
      <Field label="Name">
        <input
          name="name"
          required
          maxLength={60}
          defaultValue={name}
          placeholder="Monthly"
          className={inputClass}
        />
      </Field>
      <Field label="Months">
        <input
          name="durationMonths"
          type="number"
          min={1}
          max={24}
          required
          defaultValue={months}
          className={inputClass}
        />
      </Field>
      <Field
        label="Usual fee (₹/month)"
        hint={fee !== null ? `Now ${formatPaise(fee)}` : undefined}
      >
        <input
          name="defaultFee"
          inputMode="decimal"
          required
          defaultValue={fee !== null ? paiseToInput(fee) : ""}
          placeholder="600"
          className={inputClass}
        />
      </Field>
    </div>
  );
}
