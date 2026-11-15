import type { ButtonHTMLAttributes } from "react";

type Variant = "light" | "dark" | "outline-dark" | "outline-light";

const base =
  "inline-flex min-h-12 items-center justify-center gap-3 px-6 text-sm font-bold tracking-[0.08em] uppercase transition-[background-color,color,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  light: "bg-white text-ink hover:bg-mist",
  dark: "bg-ink text-white hover:bg-ash",
  "outline-dark": "border-2 border-ink text-ink hover:bg-ink hover:text-white",
  "outline-light":
    "border-2 border-white text-white hover:bg-white hover:text-ink",
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
