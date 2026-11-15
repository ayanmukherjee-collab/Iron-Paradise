import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission, viewerCan } from "@/auth/session";
import { inputClass } from "@/components/ui/field";
import { formatDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { StatusBadge } from "@/members/components/status-badge";
import { formatMobile } from "@/members/phone";
import { listMembers, type MemberSummary } from "@/members/queries";

export const metadata: Metadata = { title: "Members" };

const filters = {
  current: {
    label: "Current",
    keep: (m: MemberSummary) => m.status !== "inactive",
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
  const query =
    typeof params.q === "string" ? params.q.trim().slice(0, 60) : "";
  const filter: FilterKey =
    typeof params.filter === "string" && params.filter in filters
      ? (params.filter as FilterKey)
      : "current";

  const everyone = await listMembers(viewer);
  const shown = everyone
    .filter(filters[filter].keep)
    .filter((member) => matchesSearch(member, query));
  const counts = Object.fromEntries(
    (Object.keys(filters) as FilterKey[]).map((key) => [
      key,
      everyone.filter(filters[key].keep).length,
    ]),
  ) as Record<FilterKey, number>;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-5xl">Members</h1>
        {viewerCan(viewer, "members.edit") && (
          <Link
            href="/app/members/new"
            className="inline-flex min-h-12 items-center bg-ink px-6 text-sm font-bold tracking-[0.08em] text-white uppercase hover:bg-ash"
          >
            Add member
          </Link>
        )}
      </div>

      <form className="mt-6" role="search">
        <input type="hidden" name="filter" value={filter} />
        <label className="sr-only" htmlFor="member-search">
          Search members
        </label>
        <input
          id="member-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Name, phone or member ID"
          className={inputClass}
        />
      </form>

      <nav
        aria-label="Filter members"
        className="-mx-4 mt-4 [scrollbar-width:none] overflow-x-auto px-4"
      >
        <ul className="flex gap-2">
          {(Object.keys(filters) as FilterKey[]).map((key) => (
            <li key={key}>
              <Link
                href={{
                  query: { filter: key, ...(query ? { q: query } : {}) },
                }}
                aria-current={key === filter ? "page" : undefined}
                className={`inline-flex min-h-10 items-center border-2 border-ink px-3 text-sm font-semibold whitespace-nowrap ${
                  key === filter ? "bg-ink text-white" : "bg-white"
                }`}
              >
                {filters[key].label} · {counts[key]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {filter === "quiet" && (
        <p className="mt-4 max-w-prose text-smoke">
          No visit and no payment for a while. Check in with them, freeze their
          membership, or mark them inactive from their page. Nothing happens on
          its own.
        </p>
      )}

      {shown.length === 0 ? (
        <p className="mt-8 text-lg">
          {everyone.length === 0 ? "No members yet." : "Nobody matches that."}
        </p>
      ) : (
        <ul className="mt-6 border-t-2 border-ink">
          {shown.map((member) => (
            <li key={member.id} className="border-b-2 border-ink">
              <Link
                href={`/app/members/${member.id}`}
                className="block py-4 hover:bg-white"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-lg font-semibold">{member.fullName}</p>
                  <div className="flex items-center gap-2">
                    {member.goneQuiet && (
                      <span className="text-xs font-bold tracking-[0.08em] uppercase">
                        Gone quiet
                      </span>
                    )}
                    <StatusBadge status={member.status} />
                  </div>
                </div>
                <p className="mt-1 flex flex-wrap gap-x-4 text-smoke">
                  <span className="font-mono text-ink">
                    {member.memberCode}
                  </span>
                  <span>{formatMobile(member.phone)}</span>
                  {member.feePaise !== null && member.status !== "free" && (
                    <span>{formatPaise(member.feePaise)}/month</span>
                  )}
                  {member.nextDue && (
                    <span>Next due {formatDate(member.nextDue)}</span>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
