import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { requirePermission, viewerCan } from "@/auth/session";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { inputBase } from "@/components/ui/field";
import { iconButton } from "@/components/ui/viz";
import { formatShortDate, todayAtGym } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { StatusBadge } from "@/members/components/status-badge";
import { listMembers, type MemberSummary } from "@/members/queries";
import { standingLabels } from "@/payments/describe";

export const metadata: Metadata = { title: "Members" };

const filters = {
  current: {
    label: "Current",
    keep: (m: MemberSummary) => m.status !== "inactive",
  },
  overdue: {
    label: "Overdue",
    keep: (m: MemberSummary) => m.standing === "overdue",
  },
  due: {
    label: "Due soon",
    keep: (m: MemberSummary) => m.standing === "due",
  },
  quiet: { label: "Gone quiet", keep: (m: MemberSummary) => m.goneQuiet },
  frozen: {
    label: "Frozen",
    keep: (m: MemberSummary) => m.status === "frozen",
  },
  free: { label: "Free", keep: (m: MemberSummary) => m.status === "free" },
  inactive: {
    label: "Inactive",
    keep: (m: MemberSummary) => m.status === "inactive",
  },
  all: { label: "All", keep: () => true },
} as const;

type FilterKey = keyof typeof filters;

// Only owners and managers see who owes what; trainers get the rest.
const paymentFilters = new Set<FilterKey>(["overdue", "due"]);

function matchesSearch(member: MemberSummary, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  const digits = query.replace(/\D/g, "");
  return (
    member.fullName.toLowerCase().includes(needle) ||
    member.memberCode.toLowerCase().includes(needle) ||
    (digits.length >= 3 && member.phone.includes(digits))
  );
}

export default async function MembersPage({
  searchParams,
}: PageProps<"/app/members">) {
  const viewer = await requirePermission("members.view", "/app/members");
  const params = await searchParams;
  const seesPayments = viewerCan(viewer, "payments.viewSheet");
  const filterKeys = (Object.keys(filters) as FilterKey[]).filter(
    (key) => seesPayments || !paymentFilters.has(key),
  );
  const query =
    typeof params.q === "string" ? params.q.trim().slice(0, 60) : "";
  const filter: FilterKey =
    typeof params.filter === "string" &&
    filterKeys.includes(params.filter as FilterKey)
      ? (params.filter as FilterKey)
      : "current";

  const everyone = await listMembers(viewer);
  const today = todayAtGym();
  const shown = everyone
    .filter(filters[filter].keep)
    .filter((member) => matchesSearch(member, query));
  const counts = Object.fromEntries(
    filterKeys.map((key) => [key, everyone.filter(filters[key].keep).length]),
  ) as Record<FilterKey, number>;

  return (
    <section>
      <header className="page-header flex items-center justify-between gap-3">
        <h1 className="page-title">Members</h1>
        {viewerCan(viewer, "members.edit") && (
          <Link
            href="/app/members/new"
            aria-label="Add member"
            title="Add member"
            className={`${iconButton} bg-ink text-white hover:bg-graphite`}
          >
            <NavIconSvg icon="plus" className="size-5" />
          </Link>
        )}
      </header>

      <form className="relative mt-5" role="search">
        <input type="hidden" name="filter" value={filter} />
        <label className="sr-only" htmlFor="member-search">
          Search members
        </label>
        <NavIconSvg
          icon="search"
          className="pointer-events-none absolute top-1/2 left-3.5 size-[1.1rem] -translate-y-1/2 text-muted"
        />
        <input
          id="member-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Name, phone or member ID"
          className={`${inputBase} pl-10`}
        />
      </form>

      <nav
        aria-label="Filter members"
        className="-mx-4 mt-3 [scrollbar-width:none] overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        <ul className="flex gap-2">
          {filterKeys.map((key) => (
            <li key={key}>
              <Link
                href={{
                  query: { filter: key, ...(query ? { q: query } : {}) },
                }}
                aria-current={key === filter ? "page" : undefined}
                className="chip"
              >
                {filters[key].label}
                <span
                  className={`tabular-nums ${key === filter ? "text-white/60" : "text-muted"}`}
                >
                  {counts[key]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-card bg-white p-6 text-center text-muted shadow-card">
          {everyone.length === 0 ? "No members yet" : "No match"}
        </p>
      ) : (
        <ul className="mt-4 list-card">
          {shown.map((member) => (
            <li key={member.id} className="list-row">
              <Link
                href={`/app/members/${member.id}`}
                className="-mx-5 flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-canvas/50 sm:-mx-6 sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{member.fullName}</p>
                    {!member.hasAccount && (
                      <span className="sr-only">, no app account</span>
                    )}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                    <span className="font-mono text-xs text-ink">
                      {member.memberCode}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {member.lastVisit
                        ? member.lastVisit === today
                          ? "In today"
                          : `Last in ${formatShortDate(member.lastVisit, today)}`
                        : "—"}
                    </span>
                    {member.goneQuiet && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Gone quiet</span>
                      </>
                    )}
                  </p>
                </div>
                {/* Active is the norm, so only other states get a badge. */}
                <div className="flex shrink-0 items-center gap-2">
                  {member.status !== "active" && (
                    <StatusBadge status={member.status} />
                  )}
                  {member.owedPaise > 0 ? (
                    <span className="rounded-badge bg-ink px-2 py-1 text-xs font-semibold text-white tabular-nums">
                      <span className="sr-only">Owes </span>
                      {formatPaise(member.owedPaise)}
                    </span>
                  ) : member.standing === "paid" ? (
                    <span
                      role="img"
                      aria-label={standingLabels.paid}
                      title={standingLabels.paid}
                      className="flex size-6 items-center justify-center rounded-full bg-canvas"
                    >
                      <NavIconSvg icon="check" className="size-3.5" />
                    </span>
                  ) : member.standing === "due" ? (
                    <span
                      role="img"
                      aria-label={standingLabels.due}
                      title={standingLabels.due}
                      className="flex size-6 items-center justify-center"
                    >
                      <span className="size-2 rounded-full bg-ink" />
                    </span>
                  ) : null}
                </div>
                <NavIconSvg
                  icon="chevronRight"
                  className="size-4 shrink-0 text-muted"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
