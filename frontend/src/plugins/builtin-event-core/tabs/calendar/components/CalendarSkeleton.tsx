// input:  [shared Skeleton primitive and optional viewport-bound shell height]
// output: [`CalendarSkeleton` loading placeholder for the Calendar tab]
// pos:    [compact calendar-only skeleton that uses only Skeleton blocks and can match the final Calendar shell height]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface CalendarSkeletonProps {
  viewportBoundHeight?: number | null;
}

export const CalendarSkeleton: React.FC<CalendarSkeletonProps> = ({ viewportBoundHeight }) => {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div
        className="grid h-full min-h-0 min-w-0 grid-rows-[auto_1fr] gap-3 overflow-hidden p-3 sm:p-4"
        style={viewportBoundHeight ? { height: `${viewportBoundHeight}px` } : undefined}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        </div>

        <div className="min-h-0 min-w-0 overflow-hidden">
          <Skeleton className="h-full w-full rounded-md" />
        </div>
      </div>
    </div>
  );
};
