import { Bar, LoadingRegion } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion label="Loading form">
      <Bar className="h-12 w-64 max-w-full" />
      <div className="mt-8 max-w-prose space-y-6">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index}>
            <Bar className="h-4 w-28" />
            <Bar className="mt-2 h-12 w-full" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
