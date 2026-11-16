import Link from "@/components/ui/link";
import type { ReactNode } from "react";

type Variant = "blaze" | "light" | "ghost";

const BASE =
  "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-control px-5 text-[0.95rem] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.98]";

const variants: Record<Variant, string> = {
  // Sign in, and only sign in: the one orange button people learn to look for.
  blaze: `${BASE} blaze-texture bg-blaze font-bold text-white hover:bg-blaze-deep`,
  light: `${BASE} bg-white text-ink hover:bg-mist`,
  ghost: `${BASE} bg-white/[0.08] text-white ring-1 ring-white/10 hover:bg-white/15`,
};

type ButtonLinkProps = {
  href: string;
  variant?: Variant;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
};

/** A link that looks like a button. External links open in a new tab. */
export function ButtonLink({
  href,
  variant = "light",
  children,
  className = "",
  ...rest
}: ButtonLinkProps) {
  const classes = `${variants[variant]} ${className}`;
  return (
    <SmartLink href={href} className={classes} {...rest}>
      {children}
    </SmartLink>
  );
}

/** Next.js links for our own pages, plain anchors for everything else. */
export function SmartLink({
  href,
  className,
  children,
  ...rest
}: {
  href: string;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  if (/^(https?:|tel:|mailto:|#)/.test(href)) {
    const opensNewTab = href.startsWith("http");
    return (
      <a
        href={href}
        className={className}
        {...rest}
        {...(opensNewTab
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}
