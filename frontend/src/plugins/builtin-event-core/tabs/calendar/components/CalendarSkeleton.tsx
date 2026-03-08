// input:  [shared Skeleton primitive]
// output: [`CalendarSkeleton` loading placeholder for the Calendar tab]
// pos:    [compact calendar-only skeleton that mirrors the final toolbar and grid shell without heavy placeholder noise]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const DAY_COLUMN_COUNT = 7;
const WEEK_ROW_COUNT = 5;

export const CalendarSkeleton: React.FC = () => {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden rounded-xl bg-card p-3 sm:p-4">
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

        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border/70 bg-background/80 p-3 sm:p-4">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${DAY_COLUMN_COUNT}, minmax(0, 1fr))` }}>
            {Array.from({ length: DAY_COLUMN_COUNT }).map((_, index) => (
              <Skeleton key={`calendar-head-${index}`} className="h-4 w-full rounded-full opacity-70" />
            ))}
          </div>

          <div className="mt-4 space-y-2.5">
            {Array.from({ length: WEEK_ROW_COUNT }).map((_, rowIndex) => (
              <div
                key={`calendar-row-${rowIndex}`}
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${DAY_COLUMN_COUNT}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: DAY_COLUMN_COUNT }).map((__, columnIndex) => (
                  <Skeleton
                    key={`calendar-cell-${rowIndex}-${columnIndex}`}
                    className="h-16 rounded-lg border border-border/50 bg-muted/45"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
