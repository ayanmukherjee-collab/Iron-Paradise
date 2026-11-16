import type { ReactNode } from "react";

/** An input with no outer margin, for toolbars and inline rows. */
export const inputBase =
  "block min-h-12 w-full rounded-control border border-line bg-white px-4 text-base text-ink shadow-[inset_0_1px_2px_rgb(16_16_20/0.04)] transition-[border-color,box-shadow] placeholder:text-muted/80 hover:border-ink/25 focus-visible:border-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/10";

/** An input under its label. */
export const inputClass = `mt-1.5 ${inputBase}`;

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-medium ${className}`}>
      {label}
      {children}
      {hint && (
        <span className="mt-1.5 block font-normal text-muted">{hint}</span>
      )}
    </label>
  );
}

export function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex min-h-12 items-center gap-3 text-base">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-5 rounded accent-ink"
      />
      {label}
    </label>
  );
}
