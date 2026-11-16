import { standingLabels } from "@/payments/describe";
import type { Standing } from "@/payments/ledger";

const styles: Record<Standing, string> = {
  paid: "bg-white text-ink ring-1 ring-inset ring-ink/20",
  due: "bg-ink/10 text-ink",
  overdue: "bg-ink text-white",
  free: "bg-white text-ink ring-1 ring-inset ring-ink/20",
};

export function StandingBadge({ standing }: { standing: Standing }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-badge px-2 py-1 text-xs font-medium ${styles[standing]}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${standing === "free" ? "ring-1 ring-current" : "bg-current"}`}
      />
      {standingLabels[standing]}
    </span>
  );
}
