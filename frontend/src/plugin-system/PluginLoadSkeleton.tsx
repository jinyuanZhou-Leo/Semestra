// input:  [UI skeleton primitive and plugin loading states from tab/widget wrappers]
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

export const PluginTabSkeleton: React.FC = () => {
    return (
        // Keep horizontal alignment with page content; outer layout already controls side spacing.
        <div data-testid="plugin-tab-skeleton" className="space-y-4 py-4">
            <Skeleton className="h-9 w-52" />
            <Skeleton className="h-[420px] w-full rounded-xl" />
        </div>
    );
};

export const PluginWidgetSkeleton: React.FC = () => {
    return (
        <div
            data-testid="plugin-widget-skeleton"
            className="flex h-full flex-col overflow-hidden rounded-[var(--radius-widget)] border border-border/60 bg-card shadow-sm"
        >
            <div className="flex h-full flex-col gap-3 p-3">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-full min-h-[140px] w-full rounded-lg" />
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
