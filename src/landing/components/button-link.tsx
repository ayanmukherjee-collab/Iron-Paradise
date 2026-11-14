import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "light" | "dark" | "outline-dark" | "text-light" | "text-dark";

const BLOCK =
  "inline-flex min-h-12 items-center justify-center px-6 text-sm font-bold tracking-[0.08em] uppercase transition-[background-color,color,transform] duration-150 active:translate-y-px";
const TEXT =
  "inline-flex min-h-12 items-center text-[0.95rem] font-semibold underline decoration-2 underline-offset-[6px] transition-colors duration-150";

const variants: Record<Variant, string> = {
  light: `${BLOCK} bg-white text-ink hover:bg-mist`,
  dark: `${BLOCK} bg-ink text-white hover:bg-ash`,
  "outline-dark": `${BLOCK} border-2 border-ink text-ink hover:bg-ink hover:text-white`,
  "text-light": `${TEXT} text-white decoration-white/40 hover:decoration-white`,
  "text-dark": `${TEXT} text-ink decoration-ink/30 hover:decoration-ink`,
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
  const classes = `${variants[variant]} ${className}`;

  if (/^(https?:|tel:|mailto:)/.test(href)) {
    const opensNewTab = href.startsWith("http");
    return (
      <a
        href={href}
        className={classes}
        {...(opensNewTab
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
