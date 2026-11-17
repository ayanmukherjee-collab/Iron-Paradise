import type { AnchorHTMLAttributes, ReactNode, Ref } from "react";
import { Link as RouterLink } from "react-router";

// next/link for the static app: the shared components keep importing
// next/link (through components/ui/link) and get React Router's link.
type Href = string | { pathname?: string; query?: Record<string, string> };

export interface LinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> {
  href: Href;
  prefetch?: boolean | null | "auto";
  replace?: boolean;
  scroll?: boolean;
  children?: ReactNode;
  ref?: Ref<HTMLAnchorElement>;
}

function toPath(href: Href): string {
  if (typeof href === "string") return href;
  const query = href.query ? `?${new URLSearchParams(href.query)}` : "";
  return `${href.pathname ?? ""}${query}`;
}

export default function Link(all: LinkProps) {
  // prefetch means nothing here: every screen ships with the app.
  const { href, prefetch, scroll, replace, ...props } = all;
  void prefetch;
  const to = toPath(href);
  // Off-site and non-http links (tel:, https://wa.me) stay plain anchors.
  // "?filter=…" (a query on the current page) stays in the app.
  if (!to.startsWith("/") && !to.startsWith("?"))
    return <a href={to} {...props} />;
  return (
    <RouterLink
      to={to}
      replace={replace}
      preventScrollReset={scroll === false}
      {...props}
    />
  );
}
