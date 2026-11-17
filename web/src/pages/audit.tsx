// Mirrors src/app/app/audit/page.tsx.
import { formatDateTime } from "@/lib/dates";
import { describeAuditEntry } from "@/members/audit-text";
import { listAuditEntries, type AuditEntry } from "../data/members";
import { Loaded, useLoad, useTitle } from "../data/use-load";

export function AuditPage() {
  useTitle("Audit log");
  const state = useLoad(() => listAuditEntries(), []);
  return (
    <Loaded state={state}>
      {(entries) => <AuditView entries={entries} />}
    </Loaded>
  );
}

function AuditView({ entries }: { entries: AuditEntry[] }) {
  return (
    <section>
      <header className="page-header">
        <h1 className="page-title">Audit log</h1>
      </header>
      {entries.length === 0 ? (
        <p className="mt-2 rounded-card bg-white p-6 text-center text-muted shadow-card">
          Nothing yet
        </p>
      ) : (
        <ol className="mt-2 list-card">
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
