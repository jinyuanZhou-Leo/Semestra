import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const CalendarSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-7 w-32" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3 sm:p-4">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={`calendar-header-${index}`} className="h-8" />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, index) => (
            <Skeleton key={`calendar-grid-${index}`} className="h-[84px]" />
          ))}
        </div>
      </div>
    </div>
  );
};
