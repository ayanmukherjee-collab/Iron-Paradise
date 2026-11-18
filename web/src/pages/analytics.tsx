// Analytics: the last twelve months as charts, then the five latest changes.
// The figures come summed from the database (public.monthly_analytics), which
// reads the yearly-close totals for months that have been closed.
import { StatCard } from "@/components/ui/viz";
import { formatDateTime, formatMonth } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { describeAuditEntry } from "@/members/audit-text";
import { getMonthlyAnalytics, type MonthFigures } from "../data/analytics";
import { listAuditEntries, type AuditEntry } from "../data/members";
import { Loaded, useLoad, useTitle } from "../data/use-load";
import { MonthBars, MonthLine } from "./analytics-charts";

const logSize = 5;

export function AnalyticsPage() {
  useTitle("Analytics");
  // Loaded separately, so one failing doesn't hide the other.
  const figures = useLoad(() => getMonthlyAnalytics(12), [], "analytics");
  const log = useLoad(() => listAuditEntries(logSize), [], "simple-log");
  return (
    <section>
      <header className="page-header">
        <h1 className="page-title">Analytics</h1>
      </header>
      <div className="mt-2">
        <Loaded state={figures}>
          {(months) => <Figures months={months} />}
        </Loaded>
      </div>
      <h2 className="mt-10 section-title">Log</h2>
      <p className="text-sm text-muted">The last {logSize} changes</p>
      <div className="mt-3">
        <Loaded state={log}>
          {(entries) => <SimpleLog entries={entries} />}
        </Loaded>
      </div>
    </section>
  );
}

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);
const money = (paise: number) => formatPaise(paise);

function Figures({ months }: { months: MonthFigures[] }) {
  if (months.length === 0) return null;
  const labels = months.map((m) => m.month);
  const first = months[0];
  const now = months[months.length - 1];
  const memberChange = now.members - first.members;
  const joined = sum(months.map((m) => m.joined));
  const collected = sum(months.map((m) => m.collectedPaise));
  const payments = sum(months.map((m) => m.payments));
  const checkIns = sum(months.map((m) => m.checkIns));
  const corrections = sum(months.map((m) => m.corrections));
  // Average over the months that have any money, so a gym that started
  // using the app recently isn't shown a smaller figure than it earns.
  const moneyMonths = months.filter((m) => m.collectedPaise > 0).length;
  const perMonth = moneyMonths ? Math.round(collected / moneyMonths) : 0;
  const since = formatMonth(first.month.slice(0, 7));

  return (
    <>
      <p className="text-sm text-muted">
        Last 12 months, {since} to now. This month is still running.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          icon="rupee"
          label="Dues collected"
          figure={money(collected)}
          lit
          className="col-span-2 lg:col-span-1"
        />
        <StatCard
          icon="members"
          label={`Members now · ${memberChange >= 0 ? "+" : "−"}${Math.abs(memberChange)} in a year`}
          figure={now.members.toLocaleString("en-IN")}
        />
        <StatCard
          icon="plus"
          label="New admissions"
          figure={joined.toLocaleString("en-IN")}
        />
        <StatCard
          icon="payments"
          label={`A month on average · ${payments.toLocaleString("en-IN")} payments`}
          figure={money(perMonth)}
        />
        <StatCard
          icon="attendance"
          label="Check-ins"
          figure={checkIns.toLocaleString("en-IN")}
        />
        <StatCard
          icon="refresh"
          label="Payments fixed"
          figure={corrections.toLocaleString("en-IN")}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <MonthBars
          className="lg:col-span-2"
          title="Dues collected"
          months={labels}
          format={money}
          series={[
            {
              key: "cash",
              label: "Cash",
              fill: "fill-ink",
              dot: "bg-ink",
              values: months.map((m) => m.cashPaise),
            },
            {
              key: "upi",
              label: "UPI",
              fill: "fill-smoke",
              dot: "bg-smoke",
              values: months.map((m) => m.upiPaise),
            },
            {
              key: "other",
              label: "Other",
              fill: "fill-mist",
              dot: "bg-mist",
              values: months.map((m) => m.otherPaise),
            },
          ]}
          extra={(i) => (
            <span className="text-xs text-muted">
              {months[i].payments} payments
            </span>
          )}
        />
        <MonthLine
          title="Members"
          months={labels}
          values={months.map((m) => m.members)}
          extra={(i) =>
            months[i].joined > 0 ? (
              <span className="text-xs text-muted">
                {months[i].joined} joined
              </span>
            ) : null
          }
        />
        <MonthBars
          title="New admissions"
          months={labels}
          series={[
            {
              key: "joined",
              label: "Joined",
              fill: "fill-ink",
              dot: "bg-ink",
              values: months.map((m) => m.joined),
            },
          ]}
        />
        <MonthBars
          title="Check-ins"
          months={labels}
          series={[
            {
              key: "check-ins",
              label: "Check-ins",
              fill: "fill-ink",
              dot: "bg-ink",
              values: months.map((m) => m.checkIns),
            },
          ]}
          extra={(i) => (
            <span className="text-xs text-muted">
              {months[i].membersVisited} members came
            </span>
          )}
        />
        <MonthBars
          title="Payments fixed"
          months={labels}
          series={[
            {
              key: "corrections",
              label: "Voided or corrected",
              fill: "fill-ink",
              dot: "bg-ink",
              values: months.map((m) => m.corrections),
            },
          ]}
          extra={() => (
            <span className="text-xs text-muted">voided or corrected</span>
          )}
        />
      </div>
    </>
  );
}

function SimpleLog({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-card bg-white p-6 text-center text-muted shadow-card">
        Nothing yet
      </p>
    );
  }
  return (
    <ol className="list-card">
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
  );
}
