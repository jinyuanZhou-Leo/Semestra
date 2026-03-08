// input:  [UI skeleton primitive and widget card ring conventions from tab/widget wrappers]
// output: [`PluginTabSkeleton`, `PluginWidgetSkeleton`, and `PluginContentFadeIn` loading/transition helpers]
// pos:    [Loading fallback visuals and fade-in wrappers while lazy plugin runtime modules are fetched]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export const PLUGIN_CONTENT_FADE_IN_CLASSNAME =
    'h-full motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300';

const widgetFrameClassName =
    'overflow-hidden rounded-[var(--radius-widget)] bg-card text-card-foreground ring-1 ring-foreground/10 shadow-none';

export const PluginTabSkeleton: React.FC = () => {
    return (
        <div data-testid="plugin-tab-skeleton" className="space-y-4 py-4">
            <Skeleton className="h-9 w-52" />
            <Skeleton className="h-[320px] w-full rounded-xl sm:h-[360px]" />
        </div>
    );
};

export const PluginWidgetSkeleton: React.FC = () => {
    return (
        <div
            data-testid="plugin-widget-skeleton"
            className={cn('flex h-full flex-col', widgetFrameClassName)}
        >
            <div className="flex h-full flex-col gap-3 p-3">
                <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-5 w-28" />
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-7 w-7 rounded-full" />
                        <Skeleton className="h-7 w-7 rounded-full" />
                    </div>
                </div>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-full min-h-[140px] w-full rounded-[calc(var(--radius-widget)-0.35rem)]" />
            </div>
        </div>
    );
};

export const PluginContentFadeIn: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
    children,
    className,
}) => {
    return (
        <div className={cn(PLUGIN_CONTENT_FADE_IN_CLASSNAME, className)}>
            {children}
        </div>
    );
};
