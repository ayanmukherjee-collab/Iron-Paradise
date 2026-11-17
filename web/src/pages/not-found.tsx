import Link from "@/components/ui/link";

/** What a missing record or unknown address shows, inside the app. */
export function NotFound() {
  return (
    <section className="max-w-prose space-y-4">
      <h1 className="page-title">Not found</h1>
      <p className="text-lg">
        That page or record doesn&apos;t exist, or you can&apos;t see it.
      </p>
      <Link
        href="/app"
        className="inline-flex font-semibold underline decoration-line underline-offset-4 hover:decoration-ink"
      >
        Back to Home
      </Link>
    </section>
  );
}
