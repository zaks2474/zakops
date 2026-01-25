'use client';

import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function HQLoading() {
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-y-auto gap-4 p-4 md:p-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between shrink-0">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-20" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Pipeline card */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <LoadingSkeleton variant="list" count={5} />
          </CardContent>
        </Card>

        {/* Actions card */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
          </CardHeader>
          <CardContent>
            <LoadingSkeleton variant="card" count={3} />
          </CardContent>
        </Card>
      </div>

      {/* Activity feed skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-28" />
        </CardHeader>
        <CardContent>
          <LoadingSkeleton variant="list" count={4} />
        </CardContent>
      </Card>
    </div>
  );
}
