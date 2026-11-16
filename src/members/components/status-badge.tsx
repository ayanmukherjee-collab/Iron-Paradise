import type { MembershipStatus } from "@/members/billing";

const labels: Record<MembershipStatus, string> = {
  active: "Active",
  frozen: "Frozen",
  free: "Free",
  inactive: "Inactive",
};

const styles: Record<MembershipStatus, string> = {
  active: "bg-ink text-white",
  frozen: "bg-white text-ink ring-1 ring-inset ring-ink/20",
  free: "bg-white text-ink ring-1 ring-inset ring-ink/20",
  inactive: "bg-ink/5 text-muted",
};

export function StatusBadge({ status }: { status: MembershipStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-badge px-2 py-1 text-xs font-medium ${styles[status]}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${status === "free" ? "ring-1 ring-current" : "bg-current"}`}
      />
      {labels[status]}
    </span>
  );
}
