// input:  [Canvas module payloads, Canvas link helpers, shadcn collapsible primitives, and shared class merging]
// output: [CanvasModulesView presentational component plus private collapsible module-section and item-row renderers]
// pos:    [module content renderer for the Canvas integration tab with collapsible sections, container-aligned row corners, and link-type-aware emphasis]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';

import { AppEmptyState } from '@/components/AppEmptyState';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { LmsModuleItem, LmsModuleSummary } from '@/services/api';

import { openExternalUrl } from '../tab-helpers';
import { resolveCanvasHref, resolveCanvasPageReference } from '../shared';

const CanvasModuleItemRow: React.FC<{
    item: LmsModuleItem;
    onOpenPage: (pageRef: string) => void;
    courseExternalId: string;
    canvasOrigin?: string | null;
}> = ({ item, onOpenPage, courseExternalId, canvasOrigin }) => {
    const pageRef = resolveCanvasPageReference(item.html_url ?? item.url ?? '', courseExternalId, canvasOrigin);
    const externalUrl = resolveCanvasHref(item.html_url ?? item.url ?? '', canvasOrigin);
    const isExternalOnly = !pageRef && Boolean(externalUrl);

    return (
        <button
            type="button"
            className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
            onClick={() => {
                if (pageRef) {
                    onOpenPage(pageRef);
                    return;
                }
                openExternalUrl(externalUrl);
            }}
        >
            <div className="min-w-0">
                <p
                    className={cn(
                        'truncate text-sm font-medium text-foreground',
                        isExternalOnly ? 'decoration-current underline-offset-4 hover:underline' : '',
                    )}
                >
                    {item.title}
                </p>
            </div>
            {(pageRef || externalUrl) ? <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> : null}
        </button>
    );
};

const CanvasModuleSection: React.FC<{
    moduleItem: LmsModuleSummary;
    onOpenPage: (pageRef: string) => void;
    courseExternalId: string;
    canvasOrigin?: string | null;
}> = ({ moduleItem, onOpenPage, courseExternalId, canvasOrigin }) => (
    <Collapsible defaultOpen className="group/module overflow-hidden rounded-2xl border border-border/60">
        <CollapsibleTrigger asChild>
            <button
                type="button"
                className="flex w-full items-center gap-3 bg-muted/20 px-4 py-3 text-left transition-colors hover:bg-muted/35"
            >
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/module:rotate-90" />
                <h3 className="min-w-0 truncate text-base font-semibold text-foreground">{moduleItem.name}</h3>
            </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden border-t border-border/60 data-open:animate-accordion-down data-closed:animate-accordion-up">
            {moduleItem.items.length > 0 ? (
                <div className="divide-y divide-border/60">
                    {moduleItem.items.map((item) => (
                        <div
                            key={item.module_item_id}
                            className="last:[&>button]:rounded-b-2xl"
                        >
                            <CanvasModuleItemRow
                                item={item}
                                onOpenPage={onOpenPage}
                                courseExternalId={courseExternalId}
                                canvasOrigin={canvasOrigin}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <p className="px-4 py-4 text-sm text-muted-foreground">This module does not contain any published items.</p>
            )}
        </CollapsibleContent>
    </Collapsible>
);

export const CanvasModulesView: React.FC<{
    heading: string;
    items: LmsModuleSummary[];
    onOpenPage: (pageRef: string) => void;
    courseExternalId: string;
    canvasOrigin?: string | null;
}> = ({ heading, items, onOpenPage, courseExternalId, canvasOrigin }) => {
    if (items.length === 0) {
        return (
            <AppEmptyState
                scenario="no-results"
                size="section"
                surface="inherit"
                title="No modules"
                description="Canvas does not currently expose any modules for this course."
                className="h-full"
            />
        );
    }

    return (
        <div className="min-h-0 overflow-y-auto">
            <div className="border-b border-border/60 px-5 py-4">
                <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
            </div>
            <div className="space-y-4 px-5 py-5">
                {items.map((moduleItem) => (
                    <CanvasModuleSection
                        key={moduleItem.module_id}
                        moduleItem={moduleItem}
                        onOpenPage={onOpenPage}
                        courseExternalId={courseExternalId}
                        canvasOrigin={canvasOrigin}
                    />
                ))}
            </div>
        </div>
    );
};
