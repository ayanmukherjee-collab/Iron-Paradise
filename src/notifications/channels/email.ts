import "server-only";
import {
  describeFailure,
  type Channel,
  type Fetch,
} from "@/notifications/channels/types";
import { emailText } from "@/notifications/message";

const resendUrl = "https://api.resend.com/emails";

export interface EmailSettings {
  apiKey: string;
  /** A sender on a domain verified in Resend, e.g. "Iron Paradise <fees@…>". */
  from: string;
  /** Where the email's link points: the member's home screen. */
  appUrl: string;
}

/** Reminder emails through Resend, to the member's sign-in address. */
export function createEmailChannel(
  settings: EmailSettings,
  fetchFn: Fetch = fetch,
): Channel {
  return {
    name: "email",
    reaches: (recipient) => recipient.email !== null,
    cost: () => 1,
    async send(recipient, outgoing) {
      const { subject, text } = emailText({
        fullName: recipient.fullName,
        memberCode: recipient.memberCode,
        reminder: outgoing.reminder,
        today: outgoing.today,
        appUrl: settings.appUrl,
      });
      try {
        const response = await fetchFn(resendUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.apiKey}`,
            "Content-Type": "application/json",
            // Resend drops a second request with the same key.
            "Idempotency-Key": outgoing.notificationId,
          },
          body: JSON.stringify({
            from: settings.from,
            to: [recipient.email],
            subject,
            text,
          }),
        });
        return response.ok
          ? { ok: true }
          : { ok: false, error: await describeFailure(response) };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Email failed",
        };
      }
    },
  };
}
