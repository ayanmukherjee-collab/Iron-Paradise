import type { Metadata } from "next";
import { requirePermission } from "@/auth/session";
import { Initial } from "@/components/nav/side-nav";
import { ActionForm } from "@/components/ui/action-form";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { formatDateTime, todayAtGym } from "@/lib/dates";
import { convertGuest, linkGuest } from "@/members/actions";
import { NewMembershipFields } from "@/members/components/new-membership-fields";
import { formatMobile } from "@/members/phone";
import {
  listPlans,
  listUnclaimedMembers,
  listWaitingGuests,
} from "@/members/queries";

export const metadata: Metadata = { title: "Guests" };

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
      <h1 className="page-title">Guests</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">
        People who signed in with Google on their own. Make each one a member,
        or link them to the record you already have. New staff show up here too;
        give them a role on the Team page instead.
      </p>

      {guests.length === 0 ? (
        <p className="mt-5 rounded-card bg-white p-6 text-center text-muted shadow-card">
          Nobody is waiting.
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {guests.map((guest) => {
            const name = guest.fullName || guest.email || "Guest";
            return (
              <li key={guest.id} className="overflow-hidden card">
                {/* Who signed in. The form below belongs to this account. */}
                <div className="flex items-center gap-3 border-b border-line bg-canvas/50 p-4 sm:px-6">
                  <Initial
                    name={name}
                    className="size-11 rounded-control text-base"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {guest.fullName || "No name on the account"}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {guest.email} · signed in{" "}
                      {formatDateTime(guest.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  <Tabs
                    label={`What to do with ${name}`}
                    tabs={[
                      {
                        id: "new",
                        label: "New member",
                        content: (
                          <ActionForm
                            action={convertGuest}
                            submitLabel="Add and link"
                            pendingLabel="Adding…"
                            className="space-y-4"
                          >
                            <input
                              type="hidden"
                              name="profileId"
                              value={guest.id}
                            />
                            <div className="grid gap-4 sm:grid-cols-2">
                              <Field label="Full name">
                                <input
                                  name="fullName"
                                  required
                                  maxLength={120}
                                  defaultValue={guest.fullName ?? ""}
                                  autoComplete="off"
                                  className={inputClass}
                                />
                              </Field>
                              <Field label="Mobile number">
                                <input
                                  name="phone"
                                  type="tel"
                                  inputMode="tel"
                                  required
                                  className={inputClass}
                                />
                              </Field>
                            </div>
                            <NewMembershipFields
                              plans={planOptions}
                              today={today}
                            />
                            <Checkbox
                              name="reminderConsent"
                              label="They agree to get payment reminders"
                              defaultChecked
                            />
                          </ActionForm>
                        ),
                      },
                      {
                        id: "existing",
                        label: "Already a member",
                        content: (
                          <ActionForm
                            action={linkGuest}
                            submitLabel="Link account"
                            success="Linked."
                            className="space-y-4"
                          >
                            <input
                              type="hidden"
                              name="profileId"
                              value={guest.id}
                            />
                            <Field
                              label="Their member record"
                              hint="Only members without an app account are listed."
                            >
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
                        ),
                      },
                    ]}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
