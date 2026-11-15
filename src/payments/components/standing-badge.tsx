import { standingLabels } from "@/payments/describe";
import type { Standing } from "@/payments/ledger";

const styles: Record<Standing, string> = {
  paid: "border-2 border-ink text-ink",
  due: "bg-ash text-white",
  overdue: "bg-ink text-white",
  free: "border-2 border-dashed border-ink text-ink",
};

export function StandingBadge({ standing }: { standing: Standing }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-bold tracking-[0.08em] uppercase ${styles[standing]}`}
    >
      {standingLabels[standing]}
    </span>
  );
}
