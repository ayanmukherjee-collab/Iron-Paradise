// WhatsApp, version 1: staff send it. The app opens WhatsApp with the
// message typed in and logs that it was sent; the staff member presses send.
//
// Automated WhatsApp (Meta's Cloud API, direct, paid per message) would be a
// `Channel` here like push.ts and email.ts, added to channels/index.ts.
import type { IsoDate } from "@/lib/dates";
import { whatsAppText } from "@/notifications/message";
import type { DueReminder } from "@/notifications/schedule";
import { whatsAppLink } from "@/members/phone";

export function staffWhatsAppLink(input: {
  phone: string;
  fullName: string;
  memberCode: string;
  reminder: DueReminder;
  today: IsoDate;
}): string {
  return whatsAppLink(input.phone, whatsAppText(input));
}
