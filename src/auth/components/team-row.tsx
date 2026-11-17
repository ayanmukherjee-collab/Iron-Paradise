"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/auth/action-result";
import { roleLabels } from "@/auth/permissions";
import { changeRole, setAccountActive } from "@/auth/team-actions";
import type { AssignableRole, TeamMember } from "@/auth/team-queries";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { Initial } from "@/components/nav/side-nav";
import { useAfterSave } from "@/components/ui/after-save";
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
  // The controls stay folded away behind the gear; a save folds them back.
  const [open, setOpen] = useState(false);
  const afterSave = useAfterSave();
  const [roleResult, submitRole, savingRole] = useActionState(
    async (_: Result, form: FormData) => {
      const result = await changeRole(form);
      if (result.ok) {
        setOpen(false);
        afterSave();
      }
      return result;
    },
    null,
  );
  const [activeResult, submitActive, savingActive] = useActionState(
    async (_: Result, form: FormData) => {
      const result = await setAccountActive(form);
      if (result.ok) {
        setOpen(false);
        afterSave();
      }
      return result;
    },
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
        {!isSelf && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`manage-${person.id}`}
            aria-label={`Manage ${name}`}
            title="Manage"
            onClick={() => setOpen((value) => !value)}
            className={`flex size-9 shrink-0 items-center justify-center rounded-control transition-colors ${open ? "bg-ink text-white" : "text-muted hover:bg-canvas hover:text-ink"}`}
          >
            <NavIconSvg
              icon="gear"
              className={`size-[1.15rem] transition-transform duration-300 ${open ? "rotate-90" : ""}`}
            />
          </button>
        )}
      </div>

      {!isSelf && open && (
        <div
          id={`manage-${person.id}`}
          className="mt-3 flex items-center gap-2 sm:pl-[3.25rem]"
        >
          <form
            action={submitRole}
            className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none"
          >
            <input type="hidden" name="profileId" value={person.id} />
            <label className="sr-only" htmlFor={`role-${person.id}`}>
              Role
            </label>
            <select
              id={`role-${person.id}`}
              name="role"
              defaultValue={person.role}
              className={`${inputBase} min-h-10 w-auto min-w-0 flex-1 py-0 text-sm sm:flex-none`}
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
              aria-label={person.isActive ? "Switch off" : "Switch on"}
              title={person.isActive ? "Switch off" : "Switch on"}
              className="min-h-10 px-3"
            >
              <NavIconSvg icon="power" className="size-[1.1rem]" />
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
