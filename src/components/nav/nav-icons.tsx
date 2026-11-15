// Square-cornered line icons to match the site's hard edges.
import type { ReactNode } from "react";

export type NavIcon = "home" | "members" | "guests" | "more";

const paths: Record<NavIcon, ReactNode> = {
  home: <path d="M3 11 12 3l9 8M5 9.5V21h5v-6h4v6h5V9.5" />,
  members: (
    <>
      <rect x="5" y="3" width="8" height="8" />
      <path d="M2 21v-6h14v6M16 4h4v6h-4M22 21v-6h-3" />
    </>
  ),
  guests: (
    <>
      <rect x="5" y="3" width="8" height="8" />
      <path d="M2 21v-6h14v6M19 6v6M16 9h6" />
    </>
  ),
  more: (
    <>
      <rect x="4" y="4" width="6" height="6" />
      <rect x="14" y="4" width="6" height="6" />
      <rect x="4" y="14" width="6" height="6" />
      <rect x="14" y="14" width="6" height="6" />
    </>
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
      strokeWidth="2.25"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      className={className}
    >
      {paths[icon]}
    </svg>
  );
}
