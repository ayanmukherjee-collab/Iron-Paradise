import type { ButtonHTMLAttributes } from "react";

type Variant = "light" | "dark" | "outline-dark" | "outline-light";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-6 text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  light: "bg-white text-ink hover:bg-mist",
  dark: "bg-ink text-white hover:bg-graphite",
  "outline-dark":
    "bg-white text-ink ring-1 ring-line shadow-card hover:bg-ink hover:text-white",
  "outline-light":
    "text-white ring-1 ring-white/40 hover:bg-white hover:text-ink",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({
  variant = "dark",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
