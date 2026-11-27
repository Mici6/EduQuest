import { Skeleton, SkeletonCard } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-3 h-4 w-28" />
      <Skeleton className="mb-8 h-9 w-72" />
      <div className="grid gap-5 @4xl:grid-cols-3">
        <SkeletonCard className="@4xl:col-span-2" lines={4} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
        <SkeletonCard className="@4xl:col-span-2" lines={3} />
      </div>
    </div>
  );
}
