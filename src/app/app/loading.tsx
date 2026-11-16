import { LoadingRegion, RowList, TitleBar } from "@/components/ui/skeleton";

// Fallback for every app page without its own loading.tsx. Also what Next.js
// prefetches when someone hovers or touches a link (see components/ui/link),
// so the page's shell appears at once.
export default function Loading() {
  return (
    <LoadingRegion label="Loading">
      <TitleBar />
      <RowList rows={5} />
    </LoadingRegion>
  );
}
