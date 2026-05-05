export function SkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
      <div className="aspect-[4/3] animate-pulse bg-stone-200" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded-full bg-stone-200" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-stone-200" />
        <div className="h-3 w-2/5 animate-pulse rounded-full bg-stone-200" />
        <div className="mt-auto h-5 w-1/3 animate-pulse rounded-full bg-stone-200" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={`skeleton-${i}`} />
      ))}
    </div>
  );
}
