// input:  [workspace title string, tab content node, loading flags, and shared container/skeleton primitives]
// output: [`WorkspaceNav` sticky workspace-level navigation component]
// pos:    [shared second-level navigation shell for semester/course workspaces beneath the global app header with extra-large mobile titles]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { Container } from './Container';
import { Skeleton } from '@/components/ui/skeleton';

interface WorkspaceNavProps {
    title?: string | null;
    tabs: React.ReactNode;
    isLoading?: boolean;
    tabsLoading?: boolean;
}

export const WorkspaceNav: React.FC<WorkspaceNavProps> = ({
    title,
    tabs,
    isLoading = false,
    tabsLoading = false,
}) => {
    return (
        <div className="sticky-page-header sticky left-0 right-0 top-[60px] z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/82">
            <Container className="py-2.5 sm:py-3">
                <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                        {isLoading ? (
                            <Skeleton className="h-6 w-40 sm:h-7 sm:w-48" />
                        ) : (
                            <p className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                                {title || 'Workspace'}
                            </p>
                        )}
                    </div>

                    <div className="flex w-full min-w-0 flex-1">
                        {tabsLoading ? (
                            <Skeleton className="h-10 w-full rounded-lg transition-[max-width,width] duration-300 ease-out lg:ml-auto lg:w-[min(100%,60rem)]" />
                        ) : (
                            <div className="w-full min-w-0 transition-[max-width,width] duration-300 ease-out lg:ml-auto lg:w-[min(100%,60rem)]">
                                {tabs}
                            </div>
                        )}
                    </div>
                </div>
            </Container>
        </div>
    );
};
