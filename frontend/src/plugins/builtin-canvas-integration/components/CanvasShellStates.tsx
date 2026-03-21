// input:  [shadcn skeleton primitive]
// output: [CanvasShellSkeleton and CanvasSectionLoading presentational loading states]
// pos:    [shared loading-state components for the Canvas integration tab]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';

export const CanvasShellSkeleton: React.FC = () => (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[11.75rem_minmax(0,1fr)]">
        <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/15 p-3">
            <Skeleton className="h-5 w-24 rounded-md" />
            {[0, 1, 2, 3, 4].map((index) => (
                <Skeleton key={index} className="h-9 rounded-lg" />
            ))}
            <div className="space-y-2 border-t border-border/60 pt-3">
                <Skeleton className="h-4 w-14 rounded-md" />
                {[0, 1, 2].map((index) => (
                    <Skeleton key={index} className="h-8 rounded-lg" />
                ))}
            </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/15 p-5">
            <Skeleton className="h-7 w-44 rounded-md" />
            <Skeleton className="h-4 w-56 rounded-md" />
            <Skeleton className="h-72 rounded-2xl" />
        </div>
    </div>
);

export const CanvasSectionLoading: React.FC = () => (
    <div className="space-y-4 p-5">
        <Skeleton className="h-7 w-44 rounded-md" />
        <Skeleton className="h-4 w-56 rounded-md" />
        <Skeleton className="h-72 rounded-2xl" />
    </div>
);
