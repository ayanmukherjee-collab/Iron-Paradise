// Mirrors src/app/app/members/new/page.tsx.
import { ActionForm } from "@/components/ui/action-form";
import { BackLink } from "@/components/ui/back-link";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import { todayAtGym } from "@/lib/dates";
import { NewMembershipFields } from "@/members/components/new-membership-fields";
import { addMember } from "../actions/members";
import { useTitle } from "../data/use-load";

export function NewMemberPage() {
  useTitle("Add member");
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
        <NewMembershipFields today={todayAtGym()} />
        <Checkbox
          name="reminderConsent"
          label="They agree to get payment reminders"
          defaultChecked
        />
      </ActionForm>
    </section>
  );
}
