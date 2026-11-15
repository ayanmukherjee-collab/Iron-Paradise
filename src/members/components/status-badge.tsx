import type { MembershipStatus } from "@/members/billing";

const labels: Record<MembershipStatus, string> = {
  active: "Active",
  frozen: "Frozen",
  free: "Free",
  inactive: "Inactive",
};

const styles: Record<MembershipStatus, string> = {
  active: "bg-ink text-white",
  frozen: "border-2 border-ink text-ink",
  free: "border-2 border-dashed border-ink text-ink",
  inactive: "bg-mist text-ash",
};

export function StatusBadge({ status }: { status: MembershipStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-bold tracking-[0.08em] uppercase ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
