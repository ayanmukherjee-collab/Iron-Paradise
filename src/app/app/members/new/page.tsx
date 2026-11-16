import type { Metadata } from "next";
import { requirePermission } from "@/auth/session";
import { ActionForm } from "@/components/ui/action-form";
import { BackLink } from "@/components/ui/back-link";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import { todayAtGym } from "@/lib/dates";
import { addMember } from "@/members/actions";
import { NewMembershipFields } from "@/members/components/new-membership-fields";
import { listPlans } from "@/members/queries";

export const metadata: Metadata = { title: "Add member" };

export default async function NewMemberPage() {
  const viewer = await requirePermission("members.edit", "/app/members/new");
  const plans = await listPlans(viewer, true);

  return (
    <section className="max-w-lg">
      <header className="page-header">
        <BackLink href="/app/members" label="Members" className="mb-1" />
        <h1 className="page-title">Add member</h1>
      </header>
      <ActionForm
        action={addMember}
        submitLabel="Add member"
        pendingLabel="Adding…"
        className="mt-2 space-y-5"
      >
        <Field label="Full name">
          <input
            name="fullName"
            required
            maxLength={120}
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        <Field
          label="Mobile number"
          hint="10 digits. Used for WhatsApp reminders."
        >
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            required
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        <NewMembershipFields
          plans={plans.map(({ id, name, defaultFeePaise }) => ({
            id,
            name,
            defaultFeePaise,
          }))}
          today={todayAtGym()}
        />
        <Checkbox
          name="reminderConsent"
          label="They agree to get payment reminders"
          defaultChecked
        />
      </ActionForm>
    </section>
  );
}
