// What members' phones show when staff post a notice: the heading as the
// title and the start of the notice as one short line.
import type { PushMessage } from "@/notifications/channels/push";

/** About two lines on a phone's lock screen. */
const shortLength = 120;

export function shortNotice(body: string): string {
  const text = body.replace(/\s+/g, " ").trim();
  if (text.length <= shortLength) return text;
  const cut = text.slice(0, shortLength - 1);
  // End on a whole word when one finishes reasonably near the limit.
  const space = cut.lastIndexOf(" ");
  return `${(space > shortLength * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, "")}…`;
}

export function noticePush(notice: {
  id: string;
  title: string;
  body: string;
}): PushMessage {
  return {
    title: notice.title.trim(),
    body: shortNotice(notice.body) || "New notice from Iron Paradise",
    url: "/app",
    // A notice edited and sent again replaces the old one on screen.
    tag: `notice-${notice.id}`,
  };
}
