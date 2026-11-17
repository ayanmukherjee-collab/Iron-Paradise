import { LogoMark } from "@/components/brand/logo-mark";
import type { IsoDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import type { MembershipStatus } from "@/members/billing";

const statusLabels: Record<MembershipStatus, string> = {
  active: "Active",
  frozen: "Frozen",
  free: "Free",
  inactive: "Inactive",
};

const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

/** "Nov 2026": the member-since line, card style. */
function monthYear(date: IsoDate): string {
  const [year, month] = date.split("-").map(Number);
  return `${months[month - 1]} ${year}`;
}

/** "16 Dec" */
function dayMonth(date: IsoDate): string {
  const [, month, day] = date.split("-").map(Number);
  return `${day} ${months[month - 1]}`;
}

/**
 * The member's card: who they are and where they stand, shaped like a
 * membership card (credit-card proportions) in the gym's black, with
 * manga screentone and the iP mark. Real text throughout, so it reads
 * aloud and scales with the phone's font size.
 */
export function MemberCard({
  fullName,
  memberCode,
  status,
  startsOn,
  feePaise,
  nextDue,
  owedPaise,
}: {
  fullName: string;
  memberCode: string;
  status: MembershipStatus;
  startsOn: IsoDate | null;
  feePaise: number | null;
  nextDue: IsoDate | null;
  owedPaise: number;
}) {
  const owes = owedPaise > 0;
  return (
    <section
      aria-label="Membership card"
      className="relative isolate flex aspect-[1.586/1] w-full flex-col overflow-hidden rounded-panel bg-ink p-5 text-white shadow-float sm:p-6"
    >
      {/* Screentone fading in from the top right, and a ghosted mark. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 screentone [mask-image:radial-gradient(120%_100%_at_100%_0%,black,transparent_62%)] text-white/[0.13]"
      />
      <div
        aria-hidden="true"
        className="absolute -right-8 -bottom-10 -z-10 text-white/[0.05]"
      >
        <LogoMark className="h-56 w-auto sm:h-64" />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
      />

      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2">
          <LogoMark className="h-6 w-auto" />
          <span className="font-display text-lg leading-none tracking-wide uppercase">
            Iron Paradise
          </span>
        </p>
        <span
          className={`inline-flex items-center gap-1.5 rounded-badge px-2 py-1 text-xs font-semibold ${status === "active" ? "bg-white text-ink" : "bg-white/10 text-white ring-1 ring-white/25 ring-inset"}`}
        >
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${status === "active" ? "bg-ink motion-safe:animate-pulse" : "bg-white/60"}`}
          />
          {statusLabels[status]}
        </span>
      </div>

      <div className="mt-auto min-w-0 pt-4">
        <p className="text-[0.65rem] font-semibold tracking-[0.2em] text-white/50 uppercase">
          Member
        </p>
        <p className="mt-1 truncate font-display text-3xl leading-none tracking-wide uppercase sm:text-4xl">
          {fullName}
        </p>
        <p className="mt-2 font-mono text-lg font-semibold tracking-[0.18em] text-white/85 sm:text-xl">
          {memberCode}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-white/15 pt-3 text-sm">
        <CardFact label="Since" value={startsOn ? monthYear(startsOn) : "—"} />
        <CardFact
          label="Fee"
          value={
            feePaise === null
              ? "—"
              : feePaise === 0
                ? "Free"
                : `${formatPaise(feePaise)}/mo`
          }
        />
        {owes ? (
          <CardFact label="Due now" value={formatPaise(owedPaise)} alert />
        ) : (
          <CardFact
            label="Next due"
            value={nextDue ? dayMonth(nextDue) : "—"}
          />
        )}
      </dl>
    </section>
  );
}

function CardFact({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.65rem] font-semibold tracking-[0.14em] text-white/50 uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 flex items-center gap-1.5 truncate font-semibold tabular-nums">
        {alert && (
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full bg-blaze"
          />
        )}
        {value}
      </dd>
    </div>
  );
}
