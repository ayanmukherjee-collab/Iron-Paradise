import { Bar, LoadingRegion, TitleBar } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion label="Loading payments">
      <TitleBar action />
      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Bar className="col-span-2 h-24 rounded-card sm:col-span-1" />
        <Bar className="h-24 rounded-card" />
        <Bar className="h-24 rounded-card" />
      </div>
      <div className="mt-5 flex gap-2">
        <Bar className="h-12 flex-1 rounded-control" />
        <Bar className="h-12 w-24 rounded-control" />
      </div>
      <Bar className="mt-4 h-80 w-full rounded-card" />
    </LoadingRegion>
  );
}
