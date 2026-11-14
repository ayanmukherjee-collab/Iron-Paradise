import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "light" | "dark" | "outline-light" | "outline-dark";

const variants: Record<Variant, string> = {
  light: "bg-white text-ink hover:bg-mist",
  dark: "bg-ink text-white hover:bg-ash",
  "outline-light":
    "border border-white/35 text-white hover:border-white hover:bg-white/5",
  "outline-dark":
    "border border-ink/25 text-ink hover:border-ink hover:bg-ink/5",
};

type ButtonLinkProps = {
  href: string;
  variant?: Variant;
  children: ReactNode;
  className?: string;
};

export function ButtonLink({
  href,
  variant = "light",
  children,
  className = "",
}: ButtonLinkProps) {
  const isExternal = /^(https?:|tel:|mailto:)/.test(href);
  const classes = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[0.95rem] font-semibold transition-colors ${variants[variant]} ${className}`;

  if (isExternal) {
    return (
      <a
        href={href}
        className={classes}
        {...(href.startsWith("http")
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
