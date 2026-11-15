"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/auth/guarded-action";
import { roleLabels } from "@/auth/permissions";
import { changeRole, setAccountActive } from "@/auth/team-actions";
import type { AssignableRole, TeamMember } from "@/auth/team-queries";
import { Button } from "@/components/ui/button";

type Result = ActionResult | null;

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

  return (
    <li className="border-b-2 border-ink py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-lg font-semibold">
          {person.fullName || "No name yet"}
          {isSelf && (
            <span className="ml-2 text-sm font-normal text-smoke">(you)</span>
          )}
        </p>
        <p
          className={`text-sm font-bold tracking-[0.08em] uppercase ${person.isActive ? "" : "text-smoke"}`}
        >
          {person.isActive
            ? roleLabels[person.role]
            : `${roleLabels[person.role]} · switched off`}
        </p>
      </div>
      <p className="break-all text-smoke">{person.email}</p>

      {!isSelf && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          {person.role !== "member" && (
            <form action={submitRole} className="flex items-end gap-2">
              <input type="hidden" name="profileId" value={person.id} />
              <label className="flex flex-col text-sm font-semibold">
                Role
                <select
                  name="role"
                  defaultValue={person.role}
                  className="mt-1 min-h-12 border-2 border-ink bg-white px-3 text-base"
                >
                  {assignableRoles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="submit"
                variant="outline-dark"
                disabled={savingRole}
              >
                Save
              </Button>
            </form>
          )}
          <form action={submitActive}>
            <input type="hidden" name="profileId" value={person.id} />
            <input
              type="hidden"
              name="active"
              value={person.isActive ? "false" : "true"}
            />
            <Button
              type="submit"
              variant={person.isActive ? "dark" : "outline-dark"}
              disabled={savingActive}
            >
              {person.isActive ? "Switch off" : "Switch on"}
            </Button>
          </form>
        </div>
      )}

      {error && !error.ok && (
        <p role="alert" className="mt-3 border-l-4 border-ink pl-3">
          {error.error}
        </p>
      )}
    </li>
  );
}
