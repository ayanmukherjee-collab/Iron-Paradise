import type { Metadata } from "next";
import { TeamRow } from "@/auth/components/team-row";
import { isStaff, roleLabels } from "@/auth/permissions";
import { requirePermission } from "@/auth/session";
import { changeRole } from "@/auth/team-actions";
import { assignableRoles, listTeam } from "@/auth/team-queries";
import { Initial } from "@/components/nav/side-nav";
import { ActionForm } from "@/components/ui/action-form";
import { Disclosure } from "@/components/ui/disclosure";
import { inputBase } from "@/components/ui/field";

export const metadata: Metadata = { title: "Team" };

const staffRoles = ["trainer", "manager", "owner"] as const;

export default async function TeamPage() {
  const viewer = await requirePermission("roles.change", "/app/team");
  const people = await listTeam(viewer);
  // Only people who run the gym. Members are managed from their own page;
  // guests wait on the Guests page until someone gives them a role.
  const staff = people.filter((person) => isStaff(person.role));
  const signedInGuests = people.filter(
    (person) => person.role === "guest" && person.isActive,
  );

  return (
    <section className="space-y-4">
      <div>
        <h1 className="page-title">Team</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          The owner, managers and trainers. Switching someone off signs them out
          everywhere and blocks them straight away; their history stays.
        </p>
      </div>

      <Disclosure
        title="Add staff"
        summary={
          signedInGuests.length === 0
            ? "They sign in with Google first, then show up here"
            : `${signedInGuests.length} signed-in ${signedInGuests.length === 1 ? "account" : "accounts"} waiting`
        }
        icon="plus"
      >
        {signedInGuests.length === 0 ? (
          <p className="text-sm text-muted">
            Ask the new staff member to open the app and sign in with Google.
            Their account then appears here, ready for a role.
          </p>
        ) : (
          <ul className="list-card">
            {signedInGuests.map((person) => (
              <li
                key={person.id}
                className="flex flex-wrap items-center gap-3 list-row py-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Initial
                    name={person.fullName || person.email || "?"}
                    className="size-9 text-sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {person.fullName || "No name yet"}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {person.email}
                    </p>
                  </div>
                </div>
                <ActionForm
                  action={changeRole}
                  submitLabel="Give role"
                  success="Done. They now appear in the team."
                  className="flex items-start gap-2 [&>div]:mt-0"
                >
                  <input type="hidden" name="profileId" value={person.id} />
                  <label className="sr-only" htmlFor={`role-${person.id}`}>
                    Role for {person.fullName || person.email}
                  </label>
                  <select
                    id={`role-${person.id}`}
                    name="role"
                    defaultValue="trainer"
                    className={`${inputBase} w-32`}
                  >
                    {staffRoles.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </Disclosure>

      <ul className="list-card">
        {staff.map((person) => (
          <TeamRow
            key={person.id}
            person={person}
            assignableRoles={assignableRoles}
            isSelf={person.id === viewer.userId}
          />
        ))}
      </ul>
    </section>
  );
}
