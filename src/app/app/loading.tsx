import { LoadingRegion, RowList, TitleBar } from "@/components/ui/skeleton";

// Fallback for every app page without its own loading.tsx. Also lets Next.js
// prefetch the shell of each tab, so switching tabs is instant.
export default function Loading() {
  return (
    <LoadingRegion label="Loading">
      <TitleBar />
      <RowList rows={5} />
    </LoadingRegion>
  );
}
