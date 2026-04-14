const shimmerClass = 'animate-pulse bg-base-200';

export const SkeletonBlock = ({ className = '' }) => (
  <div className={`${shimmerClass} ${className}`} />
);

export const ProductCardSkeleton = () => (
  <div className="border border-base-300 bg-white p-3">
    <SkeletonBlock className="h-60 w-full" />
    <div className="mt-3 space-y-2">
      <SkeletonBlock className="h-4 w-2/3" />
      <SkeletonBlock className="h-4 w-1/3" />
      <SkeletonBlock className="h-10 w-full" />
    </div>
  </div>
);

export const ListItemSkeleton = () => (
  <div className="flex items-center gap-4 border border-base-300 bg-white p-4">
    <SkeletonBlock className="h-16 w-16" />
    <div className="flex-1 space-y-2">
      <SkeletonBlock className="h-4 w-1/2" />
      <SkeletonBlock className="h-3 w-1/3" />
    </div>
  </div>
);

export const TableRowSkeleton = ({ columns = 4 }) => (
  <div className="grid gap-3 border-b border-base-200 py-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
    {Array.from({ length: columns }).map((_, index) => (
      <SkeletonBlock key={index} className="h-4 w-full" />
    ))}
  </div>
);
