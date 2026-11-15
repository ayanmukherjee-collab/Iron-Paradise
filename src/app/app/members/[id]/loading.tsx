import { Bar, LoadingRegion } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion label="Loading member">
      <Bar className="h-4 w-24" />
      <Bar className="mt-3 h-12 w-72 max-w-full" />
      <div className="mt-4 grid max-w-md grid-cols-[auto_1fr] gap-x-8 gap-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="contents">
            <Bar className="h-5 w-20" />
            <Bar className="h-5 w-40" />
          </div>
        ))}
      </div>
      <Bar className="mt-10 h-9 w-48" />
      <Bar className="mt-4 h-40 w-full" />
    </LoadingRegion>
  );
}
