import type { Metadata } from "next";
import { requirePermission } from "@/auth/session";
import { Initial } from "@/components/nav/side-nav";
import { ActionForm } from "@/components/ui/action-form";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { formatDateTime, formatShortDate, todayAtGym } from "@/lib/dates";
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
      <header className="page-header flex items-center justify-between gap-3">
        <h1 className="page-title">Guests</h1>
        {guests.length > 0 && (
          <span className="rounded-badge bg-ink px-2.5 py-1 text-sm font-semibold text-white tabular-nums">
            {guests.length}
          </span>
        )}
      </header>

      {guests.length === 0 ? (
        <p className="mt-5 rounded-card bg-white p-6 text-center text-muted shadow-card">
          Nobody waiting
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
                    <p className="truncate text-sm text-muted">{guest.email}</p>
                  </div>
                  <div
                    className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted"
                    title={`Signed in ${formatDateTime(guest.createdAt)}`}
                  >
                    <NavIconSvg icon="clock" className="size-3.5" />
                    {formatShortDate(todayAtGym(guest.createdAt), today)}
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
                              label="Payment reminders"
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
                            <Field label="Member">
                              <select
                                name="memberId"
                                required
                                defaultValue=""
                                className={inputClass}
                              >
                                <option value="" disabled>
                                  {unclaimed.length
                                    ? "Pick a member"
                                    : "None available"}
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
