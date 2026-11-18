// Mirrors src/app/app/guests/page.tsx.
import { NavIconSvg } from "@/components/nav/nav-icons";
import { Initial } from "@/components/nav/side-nav";
import { ActionForm } from "@/components/ui/action-form";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { formatDateTime, formatShortDate, todayAtGym } from "@/lib/dates";
import { NewMembershipFields } from "@/members/components/new-membership-fields";
import { formatMobile } from "@/members/phone";
import { convertGuest, linkGuest } from "../actions/members";
import {
  listPlans,
  listUnclaimedMembers,
  listWaitingGuests,
} from "../data/members";
import { Loaded, useLoad, useTitle } from "../data/use-load";

type GuestsData = {
  guests: Awaited<ReturnType<typeof listWaitingGuests>>;
  unclaimed: Awaited<ReturnType<typeof listUnclaimedMembers>>;
  plans: Awaited<ReturnType<typeof listPlans>>;
};

export function GuestsPage() {
  useTitle("Guests");
  const state = useLoad(
    async (): Promise<GuestsData> => {
      const [guests, unclaimed, plans] = await Promise.all([
        listWaitingGuests(),
        listUnclaimedMembers(),
        listPlans(true),
      ]);
      return { guests, unclaimed, plans };
    },
    [],
    "guests",
  );
  return <Loaded state={state}>{(data) => <GuestsView {...data} />}</Loaded>;
}

function GuestsView({ guests, unclaimed, plans }: GuestsData) {
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
        <ul className="mt-5 list-card">
          {guests.map((guest) => {
            const name = guest.fullName || guest.email || "Guest";
            return (
              <li key={guest.id} className="list-row">
                {/* Folded until tapped: who signed in, and when. The form
                    inside belongs to this account. */}
                <details className="group -mx-5 sm:-mx-6">
                  <summary className="flex min-h-[4.5rem] cursor-pointer list-none items-center gap-3 px-5 py-3 transition-colors select-none hover:bg-canvas/50 sm:px-6 [&::-webkit-details-marker]:hidden">
                    <Initial
                      name={name}
                      className="size-10 rounded-control text-base"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {guest.fullName || "No name on the account"}
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {guest.email}
                      </span>
                    </span>
                    <span
                      className="shrink-0 text-xs text-muted tabular-nums"
                      title={`Signed in ${formatDateTime(guest.createdAt)}`}
                    >
                      {formatShortDate(todayAtGym(guest.createdAt), today)}
                    </span>
                    <NavIconSvg
                      icon="chevronDown"
                      className="size-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
                    />
                  </summary>

                  <div className="details-body border-t border-line px-5 pt-4 pb-5 sm:px-6">
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
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
