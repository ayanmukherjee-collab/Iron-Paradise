// Soft, round-capped line icons for the signed-in app.
import type { ReactNode } from "react";

export type NavIcon =
  | "home"
  | "members"
  | "payments"
  | "guests"
  | "attendance"
  | "checkIn"
  | "reminders"
  | "team"
  | "audit"
  | "settings"
  | "signOut"
  | "plus"
  | "arrow"
  | "clock"
  | "check"
  | "chevronLeft"
  | "chevronRight"
  | "chevronDown"
  | "sliders"
  | "sun"
  | "user"
  | "filter"
  | "download"
  | "search"
  | "moon"
  | "pause"
  | "more"
  | "qr"
  | "markIn"
  | "gear"
  | "rupee"
  | "mail"
  | "close"
  | "power"
  | "refresh"
  | "link"
  | "megaphone"
  | "pin"
  | "trash"
  | "pencil"
  | "send";

const paths: Record<NavIcon, ReactNode> = {
  megaphone: (
    <>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z" />
      <path d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" />
    </>
  ),
  pin: <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5zM12 14v6" />,
  trash: (
    <path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-12M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
  ),
  pencil: <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4" />,
  send: <path d="M4.5 11.5 20 4.5l-7 15.5-2.5-6-6-2.5zM10.5 14 20 4.5" />,
  home: (
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5.5H5.5A1.5 1.5 0 0 1 4 19z" />
  ),
  members: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.2A6.5 6.5 0 0 1 21.5 20" />
    </>
  ),
  payments: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M2.5 10h19M6.5 15h3" />
    </>
  ),
  guests: (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" />
    </>
  ),
  attendance: (
    <>
      <rect x="3.5" y="4.5" width="17" height="16" rx="3" />
      <path d="M3.5 9.5h17M8 2.5v4M16 2.5v4M9 15l2 2 4-4" />
    </>
  ),
  checkIn: (
    <>
      <path d="M3.5 8V6a2.5 2.5 0 0 1 2.5-2.5h2M16 3.5h2A2.5 2.5 0 0 1 20.5 6v2M20.5 16v2a2.5 2.5 0 0 1-2.5 2.5h-2M8 20.5H6A2.5 2.5 0 0 1 3.5 18v-2" />
      <rect x="8" y="8" width="8" height="8" rx="1.5" />
    </>
  ),
  reminders: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  team: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  audit: (
    <>
      <rect x="4.5" y="3.5" width="15" height="17" rx="3" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
    </>
  ),
  signOut: (
    <>
      <path d="M14 4.5h3.5A2 2 0 0 1 19.5 6.5v11a2 2 0 0 1-2 2H14" />
      <path d="M10 8 6 12l4 4M6 12h9" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M7 17 17 7M9 7h8v8" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  sliders: (
    <>
      <path d="M5 20v-6M5 10V4M12 20v-8M12 8V4M19 20v-4M19 12V4" />
      <path d="M3 14h4M10 8h4M17 16h4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  filter: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  download: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  pause: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 9v6M14 9v6" />
    </>
  ),
  more: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="2" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="2" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="2" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" />
    </>
  ),
  qr: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <path d="M13.5 13.5h3v3h-3zM20.5 13.5v.01M16.5 20.5h4v-4M13.5 20.5v.01" />
    </>
  ),
  markIn: (
    <>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3 20a6.5 6.5 0 0 1 13 0M16 11l2 2 4-4" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8 13.6 5l2.7-.5.9 2.6 2.6.9-.5 2.7 2.2 1.3-2.2 1.6.5 2.7-2.6.9-.9 2.6-2.7-.5L12 21.2 10.4 19l-2.7.5-.9-2.6-2.6-.9.5-2.7L2.5 12l2.2-1.6-.5-2.7 2.6-.9.9-2.6 2.7.5z" />
    </>
  ),
  rupee: <path d="M7 4.5h10M7 9h10M7 4.5h3.5a4.5 4.5 0 0 1 0 9H7l7.5 7" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m3.5 7.5 8.5 6 8.5-6" />
    </>
  ),
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  power: <path d="M12 3.5v8M7 6.5a7 7 0 1 0 10 0" />,
  refresh: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4h-4" />,
  link: (
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  ),
};

export function NavIconSvg({
  icon,
  className = "",
}: {
  icon: NavIcon;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[icon]}
    </svg>
  );
}
