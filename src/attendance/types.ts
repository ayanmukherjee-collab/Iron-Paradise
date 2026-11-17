/** What a member's check-in returns (web/src/actions/attendance.ts). */
export interface CheckInResult {
  status: "checked_in" | "already";
  firstName: string;
  /** What they owe right now; they are let in either way (owner, 2026-11-15). */
  owedPaise: number;
}
