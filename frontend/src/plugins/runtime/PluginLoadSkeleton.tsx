import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const PluginTabSkeleton: React.FC = () => {
    return (
        <div className="space-y-4 p-4 md:p-6">
            <Skeleton className="h-9 w-52" />
            <Skeleton className="h-[420px] w-full rounded-xl" />
        </div>
    );
};

export const PluginWidgetSkeleton: React.FC = () => {
    return (
        <div className="flex h-full flex-col gap-3 p-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-full min-h-[140px] w-full rounded-lg" />
        </div>
    );
};
