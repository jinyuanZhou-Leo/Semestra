import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const DAY_COLUMN_COUNT = 7;
const TIME_ROW_COUNT = 10;

const EVENT_PLACEHOLDER_MAP: Record<number, number[]> = {
  1: [0, 2, 5],
  3: [1, 4],
  5: [0, 3, 6],
  7: [2, 5],
};

export const CalendarSkeleton: React.FC = () => {
  return (
    <div className="flex h-full min-w-0 flex-col gap-3 py-4 sm:py-6">
      <div className="min-h-[460px] min-w-0 overflow-hidden rounded-lg bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-border/70 p-1">
              <Skeleton className="h-8 w-11 rounded-sm" />
              <Skeleton className="ml-1 h-8 w-11 rounded-sm" />
            </div>
            <div className="flex items-center rounded-md border border-border/70 p-1">
              <Skeleton className="h-8 w-14 rounded-sm" />
              <Skeleton className="ml-1 h-8 w-16 rounded-sm" />
            </div>
          </div>
          <Skeleton className="h-5 w-44" />
        </div>

        <div className="mt-3 min-h-[400px] min-w-0">
          <div className="w-full max-w-full overflow-x-auto rounded-md border border-border/70 bg-background [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="w-[max(100%,840px)]">
              <div
                className="grid border-b border-border/70 bg-muted/40"
                style={{ gridTemplateColumns: `72px repeat(${DAY_COLUMN_COUNT}, minmax(0, 1fr))` }}
              >
                <div className="border-r border-border/70 px-2 py-2">
                  <Skeleton className="h-3 w-10" />
                </div>
                {Array.from({ length: DAY_COLUMN_COUNT }).map((_, index) => (
                  <div key={`calendar-head-${index}`} className="border-r border-border/70 px-3 py-2 last:border-r-0">
                    <Skeleton className="h-3 w-8" />
                    <Skeleton className="mt-1 h-4 w-14" />
                  </div>
                ))}
              </div>

              <div
                className="grid"
                style={{ gridTemplateColumns: `72px repeat(${DAY_COLUMN_COUNT}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: TIME_ROW_COUNT }).map((_, rowIndex) => (
                  <React.Fragment key={`calendar-row-${rowIndex}`}>
                    <div className="border-r border-b border-border/50 px-2 py-3">
                      <Skeleton className="h-3 w-9" />
                    </div>
                    {Array.from({ length: DAY_COLUMN_COUNT }).map((_, dayIndex) => (
                      <div key={`calendar-cell-${rowIndex}-${dayIndex}`} className="border-r border-b border-border/50 p-2 last:border-r-0">
                        {EVENT_PLACEHOLDER_MAP[rowIndex]?.includes(dayIndex) ? (
                          <Skeleton className="h-10 w-[92%] rounded-md" />
                        ) : (
                          <Skeleton className="h-[1px] w-full rounded-none bg-border/35" />
                        )}
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
