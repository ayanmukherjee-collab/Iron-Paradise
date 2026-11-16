import { Dial, Meter, StatCard } from "@/components/ui/viz";
import { formatPaise } from "@/lib/money";

export interface MoneyFigures {
  /** Owed across every membership, right now. */
  outstandingPaise: number;
  /** Members owing anything. */
  owing: number;
  /** Members on a paying plan. */
  paying: number;
  /** Members past a due date. */
  overdue: number;
  /** Counted payments dated this calendar month. */
  collectedPaise: number;
}

/**
 * The money picture as separate cards: due, collected, overdue. Returned
 * as siblings so the page's own grid places them.
 */
export function MoneyCards({
  figures,
  monthLabel,
  links = true,
}: {
  figures: MoneyFigures;
  /** Short month name for the collected card, e.g. "Nov". */
  monthLabel: string;
  links?: boolean;
}) {
  const { outstandingPaise, owing, paying, overdue, collectedPaise } = figures;
  const expected = collectedPaise + outstandingPaise;
  return (
    <>
      <StatCard
        href={links ? "/app/payments" : undefined}
        icon="payments"
        label="Due"
        figure={formatPaise(outstandingPaise)}
        lit={outstandingPaise > 0}
        aside={(tone) => (
          <Dial
            value={owing}
            max={paying}
            size={44}
            stroke={4.5}
            tone={tone}
            label={`${owing} of ${paying} paying members owe`}
          >
            <span className="text-xs font-semibold tabular-nums">{owing}</span>
          </Dial>
        )}
      />
      <StatCard
        href={links ? "/app/payments" : undefined}
        icon="rupee"
        label={`Collected · ${monthLabel}`}
        figure={formatPaise(collectedPaise)}
        visual={(tone) => (
          <Meter
            value={collectedPaise}
            max={expected}
            tone={tone}
            label={`${expected > 0 ? Math.round((collectedPaise / expected) * 100) : 0}% collected`}
          />
        )}
      />
      <StatCard
        href={links ? "/app/members?filter=overdue" : undefined}
        icon="clock"
        label="Overdue"
        figure={overdue}
        aside={(tone) => (
          <Dial
            value={overdue}
            max={paying}
            size={44}
            stroke={4.5}
            tone={tone}
            label={`${overdue} of ${paying} paying members overdue`}
          >
            <span className="text-[0.65rem] font-semibold tabular-nums">
              {paying > 0 ? Math.round((overdue / paying) * 100) : 0}%
            </span>
          </Dial>
        )}
      />
    </>
  );
}

/** "Nov" for a "2026-11" month key. */
export function shortMonth(month: string): string {
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, number - 1, 1)));
}
