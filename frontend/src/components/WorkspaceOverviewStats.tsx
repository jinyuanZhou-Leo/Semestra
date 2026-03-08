// input:  [overview stat labels, optional icons, values, shared card primitives, and compact mobile spacing requirements]
// output: [`WorkspaceOverviewStats` compact stat-grid component for workspace dashboard overviews]
// pos:    [shared dashboard-only overview strip used by semester and course workspaces after title/tabs moved into navigation with tighter mobile height]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WorkspaceOverviewStatItem {
    label: string;
    icon?: React.ReactNode;
    value: React.ReactNode;
}

interface WorkspaceOverviewStatsProps {
    items: WorkspaceOverviewStatItem[];
}

export const WorkspaceOverviewStats: React.FC<WorkspaceOverviewStatsProps> = ({ items }) => {
    if (items.length === 0) return null;

    return (
        <section className="mb-2.5">
            <Card size="sm" className="border-border/70 bg-card/75 shadow-none">
                <CardContent
                    className="grid p-0"
                    style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
                >
                    {items.map((item, index) => (
                        <div
                            key={item.label}
                            className={cn(
                                'min-w-0 px-3 py-1.5 sm:px-3.5 sm:py-2.5',
                                index > 0 && 'border-l border-border/70',
                            )}
                        >
                            <div className="flex items-center gap-1.5 text-muted-foreground/80">
                                {item.icon ? (
                                    <span className="shrink-0 text-muted-foreground/70">
                                        {item.icon}
                                    </span>
                                ) : null}
                                <p className="truncate text-xs font-medium text-muted-foreground/80">
                                    {item.label}
                                </p>
                            </div>
                            <div className="mt-0.5 truncate text-sm font-semibold tracking-tight text-foreground sm:text-lg">
                                {item.value}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </section>
    );
};
