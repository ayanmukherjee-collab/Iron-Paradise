"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/auth/guarded-action";
import { roleLabels } from "@/auth/permissions";
import { changeRole, setAccountActive } from "@/auth/team-actions";
import type { AssignableRole, TeamMember } from "@/auth/team-queries";
import { Initial } from "@/components/nav/side-nav";
import { Button } from "@/components/ui/button";
import { inputBase } from "@/components/ui/field";

type Result = ActionResult | null;

// "Guest" on a staff row means taking their access away, so say that.
const roleOptionLabel = (role: AssignableRole) =>
  role === "guest" ? "Guest (no access)" : roleLabels[role];

export function TeamRow({
  person,
  assignableRoles,
  isSelf,
}: {
  person: TeamMember;
  assignableRoles: readonly AssignableRole[];
  isSelf: boolean;
}) {
  const [roleResult, submitRole, savingRole] = useActionState(
    async (_: Result, form: FormData) => changeRole(form),
    null,
  );
  const [activeResult, submitActive, savingActive] = useActionState(
    async (_: Result, form: FormData) => setAccountActive(form),
    null,
  );
  const error = [roleResult, activeResult].find(
    (result) => result && !result.ok,
  );
  const name = person.fullName || person.email || "?";

  return (
    <li className="list-row py-4">
      <div className="flex items-center gap-3">
        <Initial
          name={name}
          className={`size-10 text-sm ${person.isActive ? "" : "opacity-40"}`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {person.fullName || "No name yet"}
            {isSelf && (
              <span className="ml-2 text-sm font-normal text-muted">(you)</span>
            )}
          </p>
          <p className="truncate text-sm text-muted">{person.email}</p>
        </div>
        <span
          className={`shrink-0 rounded-badge px-2 py-1 text-xs font-medium ${person.isActive ? "bg-canvas" : "bg-canvas text-muted"}`}
        >
          {person.isActive
            ? roleLabels[person.role]
            : `${roleLabels[person.role]} · off`}
        </span>
      </div>

      {!isSelf && (
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-[3.25rem]">
          <form action={submitRole} className="flex items-center gap-2">
            <input type="hidden" name="profileId" value={person.id} />
            <label className="sr-only" htmlFor={`role-${person.id}`}>
              Role
            </label>
            <select
              id={`role-${person.id}`}
              name="role"
              defaultValue={person.role}
              className={`${inputBase} min-h-10 w-auto py-0 text-sm`}
            >
              {assignableRoles.map((role) => (
                <option key={role} value={role}>
                  {roleOptionLabel(role)}
                </option>
              ))}
            </select>
            <Button
              type="submit"
              variant="outline-dark"
              disabled={savingRole}
              className="min-h-10 px-4"
            >
              Save
            </Button>
          </form>
          <form action={submitActive}>
            <input type="hidden" name="profileId" value={person.id} />
            <input
              type="hidden"
              name="active"
              value={person.isActive ? "false" : "true"}
            />
            <Button
              type="submit"
              variant="outline-dark"
              disabled={savingActive}
              className="min-h-10 px-4"
            >
              {person.isActive ? "Switch off" : "Switch on"}
            </Button>
          </form>
        </div>
      )}

      {error && !error.ok && (
        <p role="alert" className="mt-3 callout text-sm">
          {error.error}
        </p>
      )}
    </li>
  );
}
