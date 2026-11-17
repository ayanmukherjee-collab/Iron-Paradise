import NextLink from "next/link";
import type { ComponentProps } from "react";

type LinkProps = ComponentProps<typeof NextLink>;

/**
 * next/link, but it never prefetches unless a caller passes `prefetch`.
 *
 * Every page renders per request on a Cloudflare Worker, and every prefetch
 * is a Worker run of its own, on a free plan that allows 10 ms of CPU per
 * run. Next's default prefetched each link as it scrolled into view (one
 * render per member row), and prefetching on hover still sent a burst of
 * renders whenever the pointer swept across the filter chips or the menu,
 * which ran the Worker out of CPU (503s). Now a page is fetched once, when
 * it's clicked; pages seen in the last couple of minutes come back from the
 * browser's memory (staleTimes in next.config.ts).
 */
export default function Link({ prefetch = false, ...props }: LinkProps) {
  return <NextLink prefetch={prefetch} {...props} />;
}
