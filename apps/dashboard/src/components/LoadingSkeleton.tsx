'use client';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type SkeletonVariant = 'card' | 'table' | 'list' | 'text';

interface LoadingSkeletonProps {
  /** The type of skeleton to display */
  variant?: SkeletonVariant;
  /** Number of skeleton items to display */
  count?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable loading skeleton component with multiple variants.
 * Uses animated pulse effect for visual feedback.
 */
export function LoadingSkeleton({
  variant = 'card',
  count = 1,
  className,
}: LoadingSkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  switch (variant) {
    case 'card':
      return (
        <div className={cn('space-y-4', className)}>
          {items.map((i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          ))}
        </div>
      );

    case 'table':
      return (
        <div className={cn('space-y-2', className)}>
          {/* Table header */}
          <div className="flex gap-4 p-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
          </div>
          {/* Table rows */}
          {items.map((i) => (
            <div key={i} className="flex gap-4 p-2 border-t">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          ))}
        </div>
      );

    case 'list':
      return (
        <div className={cn('space-y-3', className)}>
          {items.map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      );

    case 'text':
      return (
        <div className={cn('space-y-2', className)}>
          {items.map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      );

    default:
      return <Skeleton className={cn('h-20 w-full', className)} />;
  }
}

export default LoadingSkeleton;
