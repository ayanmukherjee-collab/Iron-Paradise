import Link from "@/components/ui/link";
import { NavIconSvg } from "@/components/nav/nav-icons";

/**
 * The way back up from a sub-page, at the very top. Names where it goes
 * ("Members", "Test 2") so nobody has to guess what "back" means.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group mb-4 -ml-1 inline-flex min-h-10 items-center gap-1.5 rounded-control pr-3 pl-1 text-sm font-medium text-muted transition-colors hover:bg-white hover:text-ink"
    >
      <NavIconSvg
        icon="chevronLeft"
        className="size-5 transition-transform group-hover:-translate-x-0.5"
      />
      {label}
    </Link>
  );
}
