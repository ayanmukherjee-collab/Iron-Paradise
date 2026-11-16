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
      return `"Gone quiet" set to ${num(after, "gone_quiet_days")} days`;
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
