// The shape every automated channel shares, so a new one (automated
// WhatsApp through Meta's Cloud API, say) is one more file, not a rewrite.
import type { IsoDate } from "@/lib/dates";
import type { ReminderMessage } from "@/notifications/message";
import type { DueReminder } from "@/notifications/schedule";
import type { PushTarget } from "@/notifications/web-push";

export type AutomatedChannelName = "push" | "email";

export interface Recipient {
  memberId: string;
  fullName: string;
  memberCode: string;
  /** From the member's linked account; null without one. */
  email: string | null;
  /** Browsers where the member's account turned on notifications. */
  pushTargets: PushTarget[];
}

export interface OutgoingReminder {
  reminder: DueReminder;
  message: ReminderMessage;
  today: IsoDate;
  /** The log row's id: lets a provider drop an accidental repeat. */
  notificationId: string;
}

export interface Delivery {
  ok: boolean;
  /** Short reason kept in the log when it failed. */
  error?: string;
  /** Push endpoints the push service says no longer exist. */
  expiredEndpoints?: string[];
}

export interface Channel {
  name: AutomatedChannelName;
  /** Whether this member can be reached here at all. */
  reaches(recipient: Recipient): boolean;
  /**
   * How many outgoing requests a send makes. Cloudflare's free plan allows
   * 50 per run, so the job stops before it runs out.
   */
  cost(recipient: Recipient): number;
  send(recipient: Recipient, outgoing: OutgoingReminder): Promise<Delivery>;
}

export type Fetch = typeof fetch;

/** First line of a provider's error, short enough for the log. */
export async function describeFailure(response: Response): Promise<string> {
  const text = (await response.text().catch(() => "")).slice(0, 200);
  return `${response.status} ${text}`.trim().slice(0, 300);
}
