"use client";

import NextLink from "next/link";
import { useState, type ComponentProps } from "react";

type LinkProps = ComponentProps<typeof NextLink>;

/**
 * next/link, but it prefetches only once someone shows they're about to use
 * the link (pointer over it, finger on it, keyboard focus), instead of
 * whenever it scrolls into view.
 *
 * Every page renders per request on a Cloudflare Worker, and each prefetch is
 * a full server render. With Next's default, scrolling the members list fired
 * one render per row and filter chip, and those bursts ran the Worker past
 * its CPU limit, so pages failed with 503s. Pass `prefetch` to choose the
 * behaviour explicitly.
 */
export default function Link({
  prefetch,
  onMouseEnter,
  onTouchStart,
  onFocus,
  ...props
}: LinkProps) {
  const [intent, setIntent] = useState(false);

  return (
    <NextLink
      {...props}
      // null is Next's default ("auto"); false holds the prefetch back.
      prefetch={prefetch !== undefined ? prefetch : intent ? null : false}
      onMouseEnter={(event) => {
        setIntent(true);
        onMouseEnter?.(event);
      }}
      onTouchStart={(event) => {
        setIntent(true);
        onTouchStart?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
    />
  );
}
