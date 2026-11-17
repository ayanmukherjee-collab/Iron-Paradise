import { LoadingRegion, RowList, TitleBar } from "@/components/ui/skeleton";

// Fallback for every app page without its own loading.tsx, shown while a
// page streams in after a link is clicked (links don't prefetch; see
// components/ui/link).
export default function Loading() {
  return (
    <LoadingRegion label="Loading">
      <TitleBar />
      <RowList rows={5} />
    </LoadingRegion>
  );
}
