import { Bar, LoadingRegion, TitleBar } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion label="Loading payments">
      <TitleBar action />
      <div className="mt-6 flex justify-between">
        <Bar className="h-10 w-24" />
        <Bar className="h-10 w-24" />
      </div>
      <Bar className="mt-6 h-96 w-full" />
    </LoadingRegion>
  );
}
