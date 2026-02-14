"use no memo";

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const DAY_COLUMN_COUNT = 7;
const EVENT_BLOCK_COUNT = 4;

export const CalendarSkeleton: React.FC = () => {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden rounded-lg bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-8 w-36 rounded-md" />
          <Skeleton className="h-8 w-44 rounded-md" />
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border/70 bg-background p-3">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${DAY_COLUMN_COUNT}, minmax(0, 1fr))` }}>
            {Array.from({ length: DAY_COLUMN_COUNT }).map((_, index) => (
              <Skeleton key={`calendar-head-${index}`} className="h-4 w-full rounded-sm" />
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: EVENT_BLOCK_COUNT }).map((_, index) => (
              <Skeleton key={`calendar-event-${index}`} className="h-20 w-full rounded-md" />
            ))}
          </div>
          <div className="mt-3">
            <Skeleton className="h-full min-h-[220px] w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
};
