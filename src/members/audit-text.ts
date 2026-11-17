// Turns raw audit rows (table, action, before/after JSON) into one readable
// line for the owner. Unknown shapes fall back to a generic sentence rather
// than hiding the entry.
import { formatPaise } from "@/lib/money";

type Row = Record<string, unknown> | null;

export interface AuditEntryInput {
  tableName: string;
  action: string;
  before: unknown;
  after: unknown;
}

const str = (row: Row, key: string) =>
  row && typeof row[key] === "string" ? (row[key] as string) : "";
const num = (row: Row, key: string) =>
  row && typeof row[key] === "number" ? (row[key] as number) : null;
const money = (paise: number | null) =>
  paise === null ? "?" : paise === 0 ? "free" : formatPaise(paise);

function dueChanges(row: Row): Row[] {
  return Array.isArray(row?.due_changes) ? (row.due_changes as Row[]) : [];
}

function startsFromDueChange(row: Row): boolean {
  return num(dueChanges(row)[0] ?? null, "from_period") === 0;
}

function dueChangeText(after: Row): string {
  const last = dueChanges(after).at(-1) ?? null;
  const on = str(last, "due_on");
  return on
    ? `Due date moved: dues now fall monthly from ${on}`
    : "Due date moved";
}

export function describeAuditEntry(entry: AuditEntryInput): string {
  const before = entry.before as Row;
  const after = entry.after as Row;

  switch (entry.tableName) {
    case "profiles":
      if (str(before, "role") !== str(after, "role")) {
        return `${str(after, "full_name") || "An account"}: role ${str(before, "role")} → ${str(after, "role")}`;
      }
      return `${str(after, "full_name") || "An account"} switched ${after?.is_active ? "on" : "off"}`;
    case "members":
      if (entry.action === "insert")
        return `Added member ${str(after, "member_code")} ${str(after, "full_name")}`;
      if (entry.action === "delete")
        return `Deleted member ${str(before, "member_code")} and all their records`;
      if (before?.is_active !== after?.is_active) {
        return `${str(after, "member_code")} ${str(after, "full_name")} marked ${after?.is_active ? "active" : "inactive"}`;
      }
      if (str(before, "profile_id") !== str(after, "profile_id")) {
        return `${str(after, "member_code")} ${str(after, "full_name")} ${str(after, "profile_id") ? "linked to an account" : "unlinked from its account"}`;
      }
      return `Edited member ${str(after, "member_code")} ${str(after, "full_name")}`;
    case "memberships":
      if (entry.action === "insert")
        return `Membership started ${str(after, "starts_on")}`;
      if (!before?.ended_on && after?.ended_on)
        return `Membership ended ${str(after, "ended_on")}`;
      if (
        JSON.stringify(before?.due_changes ?? []) !==
        JSON.stringify(after?.due_changes ?? [])
      )
        return dueChangeText(after);
      if (str(before, "billing_starts_on") !== str(after, "billing_starts_on"))
        // Staff's date at period 0 wins over the first payment's day.
        return startsFromDueChange(after)
          ? dueChangeText(after)
          : str(after, "billing_starts_on")
            ? `Dues now fall monthly from ${str(after, "billing_starts_on")}`
            : "Dues back on the joining day: no payment counts";
      return "Membership edited";
    case "membership_fees":
      return `Agreed fee set to ${money(num(after, "fee_paise"))} from ${str(after, "effective_from")}`;
    case "membership_freezes":
      if (entry.action === "insert") {
        return `Freeze from ${str(after, "starts_on")}${after?.ends_on ? ` to ${str(after, "ends_on")}` : ", no end date"}`;
      }
      return `Freeze ended ${str(after, "ends_on")}`;
    case "payments":
      return after?.replaces_payment_id
        ? `Correction of ${money(num(after, "amount_paise"))} recorded`
        : `Payment of ${money(num(after, "amount_paise"))} recorded`;
    case "payment_voids":
      return `Payment voided: ${str(after, "reason")}`;
    case "gym_settings":
      if (before?.printed_qr_enabled !== after?.printed_qr_enabled) {
        return `Printed check-in QR switched ${after?.printed_qr_enabled ? "on" : "off"}`;
      }
      if (
        [
          "morning_opens",
          "morning_closes",
          "evening_opens",
          "evening_closes",
        ].some((key) => before?.[key] !== after?.[key])
      ) {
        const hhmm = (key: string) => str(after, key).slice(0, 5);
        return `Batches set to ${hhmm("morning_opens")}–${hhmm("morning_closes")} and ${hhmm("evening_opens")}–${hhmm("evening_closes")}`;
      }
      if (
        JSON.stringify(before?.weekly_hours) !==
        JSON.stringify(after?.weekly_hours)
      ) {
        return "Opening hours changed";
      }
      if (
        [
          "crowd_capacity",
          "crowd_multiplier",
          "crowd_full_minutes",
          "crowd_gone_minutes",
        ].some((key) => before?.[key] !== after?.[key])
      ) {
        return "Crowd meter settings changed";
      }
      return `"Gone quiet" set to ${num(after, "gone_quiet_days")} days`;
    case "gym_closures": {
      const row = entry.action === "delete" ? before : after;
      const day = str(row, "closes_on");
      if (entry.action === "delete") return `Reopened ${day}`;
      const what = row?.hours ? "Short hours" : "Closed all day";
      const reason = str(row, "reason");
      return `${what} on ${day}${reason ? `: ${reason}` : ""}`;
    }
    case "announcements":
      if (entry.action === "insert")
        return `Notice posted: ${str(after, "title")}`;
      if (entry.action === "delete")
        return `Notice removed: ${str(before, "title")}`;
      if (before?.pinned !== after?.pinned)
        return `Notice ${after?.pinned ? "pinned" : "unpinned"}: ${str(after, "title")}`;
      return `Notice edited: ${str(after, "title")}`;
    case "desk_displays":
      if (entry.action === "insert")
        return `Desk display "${str(after, "label")}" set up`;
      return `Desk display "${str(after, "label")}" switched off`;
    case "checkin_codes":
      return "Printed check-in code replaced";
    default:
      return `${entry.action} on ${entry.tableName}`;
  }
}
