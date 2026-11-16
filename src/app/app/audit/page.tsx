import type { Metadata } from "next";
import { requirePermission } from "@/auth/session";
import { formatDateTime } from "@/lib/dates";
import { describeAuditEntry } from "@/members/audit-text";
import { listAuditEntries } from "@/members/queries";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage() {
  const viewer = await requirePermission("audit.view", "/app/audit");
  const entries = await listAuditEntries(viewer);

  return (
    <section>
      <h1 className="page-title">Audit log</h1>
      <p className="mt-3 max-w-prose text-lg">
        Every change to roles, members, memberships, fees and payments, newest
        first. Nobody can edit or delete these entries, including the owner.
      </p>
      {entries.length === 0 ? (
        <p className="mt-8 text-lg">Nothing recorded yet.</p>
      ) : (
        <ol className="mt-8 list-card">
          {entries.map((entry) => (
            <li key={entry.id} className="list-row py-4">
              <p className="font-semibold">{describeAuditEntry(entry)}</p>
              <p className="text-sm text-muted">
                {entry.actorName || entry.actorEmail || "System"} ·{" "}
                {formatDateTime(entry.occurredAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
