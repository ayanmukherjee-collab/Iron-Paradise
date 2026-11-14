import type { Metadata } from "next";
import { requirePermission } from "@/auth/session";
import { ActionForm } from "@/components/ui/action-form";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import { formatDateTime, todayAtGym } from "@/lib/dates";
import { convertGuest, linkGuest } from "@/members/actions";
import { NewMembershipFields } from "@/members/components/new-membership-fields";
import { formatMobile } from "@/members/phone";
import {
  listPlans,
  listUnclaimedMembers,
  listWaitingGuests,
} from "@/members/queries";

export const metadata: Metadata = { title: "Waiting guests" };

export default async function GuestsPage() {
  const viewer = await requirePermission("guests.link", "/app/guests");
  const [guests, unclaimed, plans] = await Promise.all([
    listWaitingGuests(viewer),
    listUnclaimedMembers(viewer),
    listPlans(viewer, true),
  ]);
  const planOptions = plans.map(({ id, name, defaultFeePaise }) => ({
    id,
    name,
    defaultFeePaise,
  }));
  const today = todayAtGym();

  return (
    <section>
      <h1 className="display text-5xl">Waiting guests</h1>
      <p className="mt-3 max-w-prose text-lg">
        People who signed in with Google on their own. Link each one to their
        member record, or add them as a new member. Staff accounts show up here
        too; give those a role on the Team page instead.
      </p>

      {guests.length === 0 ? (
        <p className="mt-8 text-lg">Nobody is waiting.</p>
      ) : (
        <ul className="mt-8 border-t-2 border-ink">
          {guests.map((guest) => (
            <li key={guest.id} className="border-b-2 border-ink py-6">
              <p className="text-lg font-semibold">
                {guest.fullName || "No name"}
              </p>
              <p className="break-all text-smoke">
                {guest.email} · signed up {formatDateTime(guest.createdAt)}
              </p>

              <div className="mt-5 grid gap-8 lg:grid-cols-2">
                <ActionForm
                  action={linkGuest}
                  submitLabel="Link"
                  success="Linked."
                  className="space-y-4"
                >
                  <h2 className="font-bold">Already a member?</h2>
                  <input type="hidden" name="profileId" value={guest.id} />
                  <Field label="Member record">
                    <select
                      name="memberId"
                      required
                      defaultValue=""
                      className={inputClass}
                    >
                      <option value="" disabled>
                        {unclaimed.length
                          ? "Pick a member"
                          : "No unlinked members"}
                      </option>
                      {unclaimed.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.memberCode} · {member.fullName} ·{" "}
                          {formatMobile(member.phone)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </ActionForm>

                <details className="group">
                  <summary className="cursor-pointer font-bold">
                    New to the gym? Add as a member
                  </summary>
                  <ActionForm
                    action={convertGuest}
                    submitLabel="Add and link"
                    pendingLabel="Adding…"
                    className="mt-4 space-y-4"
                  >
                    <input type="hidden" name="profileId" value={guest.id} />
                    <Field label="Mobile number">
                      <input
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        required
                        className={inputClass}
                      />
                    </Field>
                    <NewMembershipFields plans={planOptions} today={today} />
                    <Checkbox
                      name="reminderConsent"
                      label="They agree to get payment reminders"
                      defaultChecked
                    />
                  </ActionForm>
                </details>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
