import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission, viewerCan } from "@/auth/session";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { inputBase } from "@/components/ui/field";
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
      <header className="flex items-center justify-between gap-3">
        <h1 className="page-title">Members</h1>
        {viewerCan(viewer, "members.edit") && (
          <Link href="/app/members/new" className="btn-dark pr-5 pl-4">
            <NavIconSvg icon="plus" className="size-4" />
            Add member
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

      {filter === "overdue" && (
        <p className="mt-3 max-w-prose text-sm text-muted">
          A fee is past its due date and not paid in full. Overdue members are
          the old &ldquo;expired&rdquo;: their membership stays, and recording a
          payment clears it.
        </p>
      )}

      {filter === "quiet" && (
        <p className="mt-3 max-w-prose text-sm text-muted">
          No visit and no payment for a while. Check in with them, freeze their
          membership, or mark them inactive from their page. Nothing happens on
          its own.
        </p>
      )}

      {shown.length === 0 ? (
        <p className="mt-4 rounded-card bg-white p-6 text-center text-muted shadow-card">
          {everyone.length === 0 ? "No members yet." : "Nobody matches that."}
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
                        : "Never checked in"}
                    </span>
                    {member.goneQuiet && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Gone quiet</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={member.status} />
                  {member.owedPaise > 0 ? (
                    <span className="text-sm font-semibold tabular-nums">
                      Owes {formatPaise(member.owedPaise)}
                    </span>
                  ) : (
                    member.standing && (
                      <span className="text-xs text-muted">
                        {standingLabels[member.standing]}
                      </span>
                    )
                  )}
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
