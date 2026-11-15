import type { Metadata } from "next";
import { TeamRow } from "@/auth/components/team-row";
import { requirePermission } from "@/auth/session";
import { assignableRoles, listTeam } from "@/auth/team-queries";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const viewer = await requirePermission("roles.change", "/app/team");
  const people = await listTeam(viewer);

  return (
    <section>
      <h1 className="display text-5xl">Team</h1>
      <p className="mt-3 max-w-prose text-lg">
        Staff sign in with Google first, then show up here as guests. Give them
        a role. Switching someone off signs them out everywhere and blocks them
        straight away; their history stays.
      </p>
      <ul className="mt-8 border-t-2 border-ink">
        {people.map((person) => (
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
