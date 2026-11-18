// Mirrors src/app/app/members/page.tsx.
import { useEffect, useRef, useState } from "react";
import { Form, useSearchParams } from "react-router";
import Link from "@/components/ui/link";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { inputBase } from "@/components/ui/field";
import { iconButton } from "@/components/ui/viz";
import { formatShortDate, todayAtGym } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { StatusBadge } from "@/members/components/status-badge";
import { standingLabels } from "@/payments/describe";
import { useViewer, viewerCan } from "../auth/viewer";
import { listMembers, type MemberSummary } from "../data/members";
import { Loaded, useLoad, useTitle } from "../data/use-load";

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

// Rows drawn before "Show all", so a long list stays quick on a phone;
// search and the filters still cover everyone.
const firstRows = 50;

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

export function MembersPage() {
  const viewer = useViewer();
  useTitle("Members");
  const [params] = useSearchParams();
  const seesPayments = viewerCan(viewer, "payments.viewSheet");
  const filterKeys = (Object.keys(filters) as FilterKey[]).filter(
    (key) => seesPayments || !paymentFilters.has(key),
  );
  const query = (params.get("q") ?? "").trim().slice(0, 60);
  const wanted = params.get("filter");
  const filter: FilterKey =
    wanted && filterKeys.includes(wanted as FilterKey)
      ? (wanted as FilterKey)
      : "current";

  const state = useLoad(() => listMembers(viewer), [viewer.userId], "members");
  const everyone = state.status === "ready" ? state.data : [];
  const today = todayAtGym();
  const shown = everyone
    .filter(filters[filter].keep)
    .filter((member) => matchesSearch(member, query));
  const counts = Object.fromEntries(
    filterKeys.map((key) => [key, everyone.filter(filters[key].keep).length]),
  ) as Record<FilterKey, number>;
  const showAll = params.get("show") === "all";
  const drawn = showAll ? shown : shown.slice(0, firstRows);

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

      <div className="relative mt-5">
        <Form role="search">
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
            className={`${inputBase} pr-14 pl-10`}
          />
        </Form>
        <FilterMenu
          keys={filterKeys}
          current={filter}
          counts={counts}
          query={query}
        />
      </div>

      {filter !== "current" && (
        <p className="mt-3 flex items-center gap-2 px-1 text-sm text-muted">
          Showing
          <span className="font-semibold text-ink">
            {filters[filter].label}
          </span>
          <span className="tabular-nums">{counts[filter]}</span>
          <Link
            href={{
              pathname: "/app/members",
              query: query ? { q: query } : {},
            }}
            aria-label="Clear the filter"
            title="Clear the filter"
            className="ml-auto flex size-8 items-center justify-center rounded-control transition-colors hover:bg-ink hover:text-white"
          >
            <NavIconSvg icon="close" className="size-4" />
          </Link>
        </p>
      )}

      {state.status !== "ready" ? (
        <div className="mt-4">
          <Loaded state={state}>{() => null}</Loaded>
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-4 rounded-card bg-white p-6 text-center text-muted shadow-card">
          {everyone.length === 0 ? "No members yet" : "No match"}
        </p>
      ) : (
        <ul className="mt-4 list-card">
          {drawn.map((member) => (
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

      {drawn.length < shown.length && (
        <Link
          href={{
            query: { filter, ...(query ? { q: query } : {}), show: "all" },
          }}
          className="mt-3 block rounded-card bg-white p-4 text-center text-sm font-semibold shadow-card transition-colors hover:bg-canvas/50"
        >
          Show all {shown.length}
        </Link>
      )}
    </section>
  );
}

/**
 * The funnel at the right of the search box: opens the list of filters,
 * each with its count. Dark while a filter other than Current is on.
 */
function FilterMenu({
  keys,
  current,
  counts,
  query,
}: {
  keys: FilterKey[];
  current: FilterKey;
  counts: Record<FilterKey, number>;
  query: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const filtered = current !== "current";

  // A tap outside or Escape closes it.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) =>
      event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="absolute top-1/2 right-1.5 -translate-y-1/2">
      <button
        type="button"
        aria-label="Filter members"
        title="Filter"
        aria-expanded={open}
        aria-controls="member-filters"
        onClick={() => setOpen((was) => !was)}
        className={`flex size-9 items-center justify-center rounded-control transition-colors ${
          open || filtered
            ? "bg-ink text-white"
            : "text-muted hover:bg-canvas hover:text-ink"
        }`}
      >
        <NavIconSvg icon="funnel" className="size-[1.1rem]" />
      </button>
      {open && (
        <nav
          id="member-filters"
          aria-label="Filter members"
          className="absolute top-full right-0 z-30 mt-2 w-60 origin-top-right rounded-tile bg-white p-1.5 shadow-float ring-1 ring-line motion-safe:animate-drop"
        >
          <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted">Show</p>
          <ul>
            {keys.map((key) => (
              <li key={key}>
                <Link
                  href={{
                    query: { filter: key, ...(query ? { q: query } : {}) },
                  }}
                  aria-current={key === current ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors hover:bg-canvas"
                >
                  <span className="flex-1">{filters[key].label}</span>
                  <span className="text-muted tabular-nums">{counts[key]}</span>
                  <span className="flex size-4 items-center justify-center">
                    {key === current && (
                      <NavIconSvg icon="check" className="size-4" />
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
