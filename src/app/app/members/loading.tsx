import {
  Bar,
  LoadingRegion,
  RowList,
  TitleBar,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion label="Loading members">
      <TitleBar action />
      <Bar className="mt-6 h-12 w-full" />
      <div className="mt-4 flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <Bar key={index} className="h-10 w-24 shrink-0" />
        ))}
      </div>
      <RowList rows={8} />
    </LoadingRegion>
  );
}
