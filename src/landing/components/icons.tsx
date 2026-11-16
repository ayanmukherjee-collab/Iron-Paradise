// Line icons for the public landing page, drawn in the same soft,
// round-capped style as the signed-in app's icons (components/nav/nav-icons).
// The landing page leans on these so people can find their way by picture.
import type { ReactNode } from "react";

export type LandingIcon =
  | "user"
  | "phone"
  | "whatsapp"
  | "instagram"
  | "pin"
  | "clock"
  | "calendar"
  | "sun"
  | "moon"
  | "dumbbell"
  | "rack"
  | "machine"
  | "treadmill"
  | "trainer"
  | "locker"
  | "cash"
  | "upi"
  | "arrow"
  | "check"
  | "closed"
  | "external"
  | "group";

const paths: Record<LandingIcon, ReactNode> = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  phone: (
    <path d="M5.2 3.5h3l1.7 4.4-2.2 1.4a11 11 0 0 0 5 5l1.4-2.2 4.4 1.7v3a2.5 2.5 0 0 1-2.6 2.5A15.5 15.5 0 0 1 2.7 6.1a2.5 2.5 0 0 1 2.5-2.6z" />
  ),
  whatsapp: (
    <>
      <path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5z" />
      <path d="M9.3 8.2c-.6.4-.9 1.1-.6 2.1a8 8 0 0 0 5 5c1 .3 1.7 0 2.1-.6l.3-.6-2-1-.8.8a5 5 0 0 1-2.2-2.2l.8-.8-1-2z" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.2 6.8h.01" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10z" />,
  dumbbell: (
    <>
      <rect x="4.5" y="6" width="3" height="12" rx="1.2" />
      <rect x="16.5" y="6" width="3" height="12" rx="1.2" />
      <path d="M7.5 12h9M2.5 9.5v5M21.5 9.5v5" />
    </>
  ),
  rack: (
    <>
      <path d="M6 3.5v17M18 3.5v17M3.5 20.5h17M2.5 9h19" />
      <rect x="1.5" y="6.5" width="2.5" height="5" rx="1" />
      <rect x="20" y="6.5" width="2.5" height="5" rx="1" />
    </>
  ),
  machine: (
    <>
      <rect x="3.5" y="3.5" width="8.5" height="17" rx="1.5" />
      <path d="M6.5 8h2.5M6.5 11h2.5M6.5 14h2.5M12 5.5h5" />
      <circle cx="18.5" cy="5.5" r="1.5" />
      <path d="M18.5 7v8M16.5 15h4M2.5 20.5h19" />
    </>
  ),
  treadmill: (
    <>
      <rect x="2.5" y="16" width="16" height="3.5" rx="1.75" />
      <path d="M17 16 19.5 6M17.5 5.5h4M19 7.5l-4.5 2" />
    </>
  ),
  trainer: (
    <>
      <circle cx="9" cy="6.5" r="3" />
      <path d="M3.5 20.5v-2a5.5 5.5 0 0 1 11 0v2" />
      <rect x="15.5" y="9.5" width="6" height="8" rx="1.2" />
      <path d="M17.5 12.5h2M17.5 15h2" />
    </>
  ),
  locker: (
    <>
      <rect x="4.5" y="2.5" width="15" height="19" rx="2" />
      <path d="M12 2.5v19M7.5 6.5h2M14.5 6.5h2M9.5 12.5v2M14.5 12.5v2" />
    </>
  ),
  cash: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  upi: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <path d="M13.5 13.5h3v3M20.5 13.5v.01M13.5 20.5h.01M17 20.5h3.5V17" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  closed: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
    </>
  ),
  external: (
    <path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 4 18V9a2.5 2.5 0 0 1 2.5-2.5h4" />
  ),
  group: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.2A6.5 6.5 0 0 1 21.5 20" />
    </>
  ),
};

export function Icon({
  name,
  className = "size-6",
  strokeWidth = 1.75,
}: {
  name: LandingIcon;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
