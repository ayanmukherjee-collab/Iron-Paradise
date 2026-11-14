import type { ReactNode } from "react";

export const inputClass =
  "mt-1 block min-h-12 w-full border-2 border-ink bg-white px-3 text-base text-ink placeholder:text-smoke focus-visible:outline-offset-0";

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
    <label className={`block text-sm font-semibold ${className}`}>
      {label}
      {children}
      {hint && (
        <span className="mt-1 block font-normal text-smoke">{hint}</span>
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
        className="size-5 accent-ink"
      />
      {label}
    </label>
  );
}
