import { Skeleton } from "@/components/ui/skeleton";

export const RideCardSkeleton = () => (
  <div className="bg-card rounded-lg p-4 border border-border space-y-4">
    {/* Header with avatar and info */}
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3 flex-1">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <Skeleton className="w-16 h-6 rounded-full" />
    </div>

    {/* Route info */}
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>

    {/* Details grid */}
    <div className="grid grid-cols-3 gap-2">
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
    </div>

    {/* Footer with button */}
    <Skeleton className="h-10 w-full" />
  </div>
);

export const RideListSkeleton = () => (
  <div className="space-y-3 pb-20">
    {[...Array(5)].map((_, i) => (
      <RideCardSkeleton key={i} />
    ))}
  </div>
);
