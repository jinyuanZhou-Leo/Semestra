// input:  [Canvas module summary + item APIs, Canvas link helpers, TanStack Query, shadcn collapsible primitives, and shared class merging]
// output: [CanvasModulesView presentational component plus private windowed module-section and item-row renderers]
// pos:    [module content renderer for the Canvas integration tab that preserves expanded module cards while windowing offscreen sections and loading item lists on demand]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ExternalLink } from 'lucide-react';

import { AppEmptyState } from '@/components/AppEmptyState';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import api, { type LmsModuleItem, type LmsModuleSummary } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';

import { CANVAS_QUERY_OPTIONS, openExternalUrl } from '../tab-helpers';
import { resolveCanvasHref, resolveCanvasPageReference } from '../shared';

const MODULE_ROW_HEIGHT_ESTIMATE = 44;
const MODULE_HEADER_HEIGHT_ESTIMATE = 50;
const MODULE_EMPTY_STATE_HEIGHT_ESTIMATE = 72;
const MODULE_LOADING_SKELETON_ROWS = 3;
const MODULE_SECTION_GAP = 16;
const MODULE_WINDOW_OVERSCAN = 720;
const MODULE_DEFAULT_ITEM_COUNT_ESTIMATE = 6;
const MODULE_DEFAULT_VIEWPORT_HEIGHT = 720;

const getEstimatedModuleBodyHeight = (moduleItem: LmsModuleSummary) => {
    if (moduleItem.item_count === 0) {
        return MODULE_EMPTY_STATE_HEIGHT_ESTIMATE;
    }

    return Math.max(
        (moduleItem.item_count || MODULE_DEFAULT_ITEM_COUNT_ESTIMATE) * MODULE_ROW_HEIGHT_ESTIMATE,
        MODULE_EMPTY_STATE_HEIGHT_ESTIMATE,
    );
};

const getEstimatedModuleHeight = (moduleItem: LmsModuleSummary, isOpen: boolean) => {
    return MODULE_HEADER_HEIGHT_ESTIMATE + (isOpen ? getEstimatedModuleBodyHeight(moduleItem) : 0);
};

type CanvasModuleItemRowProps = {
    item: LmsModuleItem;
    onOpenPage: (pageRef: string) => void;
    courseExternalId: string;
    canvasOrigin?: string | null;
};

const CanvasModuleItemRow = React.memo(function CanvasModuleItemRow({
    item,
    onOpenPage,
    courseExternalId,
    canvasOrigin,
}: CanvasModuleItemRowProps) {
    const { pageRef, externalUrl, isExternalOnly } = React.useMemo(() => {
        const resolvedPageRef = resolveCanvasPageReference(item.html_url ?? item.url ?? '', courseExternalId, canvasOrigin);
        const resolvedExternalUrl = resolveCanvasHref(item.html_url ?? item.url ?? '', canvasOrigin);
        return {
            pageRef: resolvedPageRef,
            externalUrl: resolvedExternalUrl,
            isExternalOnly: !resolvedPageRef && Boolean(resolvedExternalUrl),
        };
    }, [canvasOrigin, courseExternalId, item.html_url, item.url]);

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
});

const CanvasModuleLoadingRows: React.FC<{ estimatedHeight: number }> = ({ estimatedHeight }) => (
    <div
        className="border-t border-border/60 px-4 py-3"
        style={{
            contentVisibility: 'auto',
            containIntrinsicSize: `${Math.max(estimatedHeight, MODULE_EMPTY_STATE_HEIGHT_ESTIMATE)}px`,
            minHeight: `${Math.max(estimatedHeight, MODULE_EMPTY_STATE_HEIGHT_ESTIMATE)}px`,
        }}
    >
        <div className="space-y-3">
            {Array.from({ length: MODULE_LOADING_SKELETON_ROWS }).map((_, index) => (
                <div key={index} className="h-4 rounded-full bg-muted/70" />
            ))}
        </div>
    </div>
);

type CanvasModuleSectionBodyProps = {
    courseId: string;
    moduleItem: LmsModuleSummary;
    onOpenPage: (pageRef: string) => void;
    courseExternalId: string;
    canvasOrigin?: string | null;
};

const CanvasModuleSectionBody = React.memo(function CanvasModuleSectionBody({
    courseId,
    moduleItem,
    onOpenPage,
    courseExternalId,
    canvasOrigin,
}: CanvasModuleSectionBodyProps) {
    const estimatedHeight = React.useMemo(
        () => getEstimatedModuleBodyHeight(moduleItem),
        [moduleItem],
    );

    const moduleItemsQuery = useQuery({
        queryKey: queryKeys.courses.lmsModuleItems(courseId, moduleItem.module_id),
        queryFn: () => api.getCourseLmsModuleItems(courseId, moduleItem.module_id),
        enabled: moduleItem.item_count > 0,
        ...CANVAS_QUERY_OPTIONS,
    });

    const resolvedItems = moduleItemsQuery.data?.items ?? [];

    return (
        <div
            className="border-t border-border/60"
            style={{
                contentVisibility: 'auto',
                containIntrinsicSize: `${estimatedHeight}px`,
            }}
        >
            {moduleItem.item_count === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">This module does not contain any published items.</p>
            ) : moduleItemsQuery.isLoading && !moduleItemsQuery.data ? (
                <CanvasModuleLoadingRows estimatedHeight={estimatedHeight} />
            ) : moduleItemsQuery.error ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">Failed to load this module&apos;s items.</p>
            ) : (
                <div className="divide-y divide-border/60">
                    {resolvedItems.map((item) => (
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
            )}
        </div>
    );
});

type CanvasModuleSectionProps = {
    courseId: string;
    moduleItem: LmsModuleSummary;
    isOpen: boolean;
    onOpenChange: (nextOpen: boolean) => void;
    onOpenPage: (pageRef: string) => void;
    courseExternalId: string;
    canvasOrigin?: string | null;
};

const CanvasModuleSection = React.memo(function CanvasModuleSection({
    courseId,
    moduleItem,
    isOpen,
    onOpenChange,
    onOpenPage,
    courseExternalId,
    canvasOrigin,
}: CanvasModuleSectionProps) {
    const handleOpenChange = React.useCallback((nextOpen: boolean) => {
        React.startTransition(() => {
            onOpenChange(nextOpen);
        });
    }, [onOpenChange]);

    return (
        <Collapsible open={isOpen} onOpenChange={handleOpenChange} className="group/module overflow-hidden rounded-2xl border border-border/60">
            <CollapsibleTrigger asChild>
                <button
                    type="button"
                    className="flex w-full items-center gap-3 bg-muted/20 px-4 py-3 text-left transition-colors hover:bg-muted/35"
                >
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/module:rotate-90" />
                    <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-semibold text-foreground">{moduleItem.name}</h3>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{moduleItem.item_count}</span>
                </button>
            </CollapsibleTrigger>
            {isOpen ? (
                <CanvasModuleSectionBody
                    courseId={courseId}
                    moduleItem={moduleItem}
                    onOpenPage={onOpenPage}
                    courseExternalId={courseExternalId}
                    canvasOrigin={canvasOrigin}
                />
            ) : null}
        </Collapsible>
    );
});

export const CanvasModulesView: React.FC<{
    courseId: string;
    heading: string;
    items: LmsModuleSummary[];
    onOpenPage: (pageRef: string) => void;
    courseExternalId: string;
    canvasOrigin?: string | null;
}> = ({ courseId, heading, items, onOpenPage, courseExternalId, canvasOrigin }) => {
    const scrollRootRef = React.useRef<HTMLDivElement | null>(null);
    const [scrollTop, setScrollTop] = React.useState(0);
    const [viewportHeight, setViewportHeight] = React.useState(MODULE_DEFAULT_VIEWPORT_HEIGHT);
    const [openModuleMap, setOpenModuleMap] = React.useState<Record<string, boolean>>(() => (
        Object.fromEntries(items.map((moduleItem) => [moduleItem.module_id, true]))
    ));

    React.useEffect(() => {
        setOpenModuleMap((currentMap) => {
            const nextMap: Record<string, boolean> = {};
            for (const moduleItem of items) {
                nextMap[moduleItem.module_id] = currentMap[moduleItem.module_id] ?? true;
            }
            return nextMap;
        });
    }, [items]);

    React.useEffect(() => {
        const root = scrollRootRef.current;
        if (!root) {
            return;
        }

        let frameId: number | null = null;
        const syncViewport = () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
            frameId = window.requestAnimationFrame(() => {
                frameId = null;
                setScrollTop(root.scrollTop);
                setViewportHeight(root.clientHeight || MODULE_DEFAULT_VIEWPORT_HEIGHT);
            });
        };

        syncViewport();
        root.addEventListener('scroll', syncViewport, { passive: true });
        window.addEventListener('resize', syncViewport);

        return () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
            root.removeEventListener('scroll', syncViewport);
            window.removeEventListener('resize', syncViewport);
        };
    }, []);

    const windowedModules = React.useMemo(() => {
        const overscanStart = Math.max(0, scrollTop - MODULE_WINDOW_OVERSCAN);
        const overscanEnd = scrollTop + viewportHeight + MODULE_WINDOW_OVERSCAN;

        let cursor = 0;
        let visibleStartIndex = 0;
        let visibleEndIndex = items.length;
        let foundStart = false;

        for (let index = 0; index < items.length; index += 1) {
            const moduleItem = items[index];
            const isOpen = openModuleMap[moduleItem.module_id] ?? true;
            const moduleHeight = getEstimatedModuleHeight(moduleItem, isOpen);
            const moduleStart = cursor;
            const moduleEnd = moduleStart + moduleHeight;

            if (!foundStart && moduleEnd >= overscanStart) {
                visibleStartIndex = index;
                foundStart = true;
            }

            if (foundStart && moduleStart > overscanEnd) {
                visibleEndIndex = index;
                break;
            }

            cursor = moduleEnd + MODULE_SECTION_GAP;
        }

        if (!foundStart) {
            visibleStartIndex = 0;
            visibleEndIndex = Math.min(items.length, 8);
        }

        let topSpacer = 0;
        for (let index = 0; index < visibleStartIndex; index += 1) {
            topSpacer += getEstimatedModuleHeight(items[index], openModuleMap[items[index].module_id] ?? true) + MODULE_SECTION_GAP;
        }

        let renderedHeight = 0;
        for (let index = visibleStartIndex; index < visibleEndIndex; index += 1) {
            renderedHeight += getEstimatedModuleHeight(items[index], openModuleMap[items[index].module_id] ?? true);
            if (index < visibleEndIndex - 1) {
                renderedHeight += MODULE_SECTION_GAP;
            }
        }

        let totalHeight = 0;
        for (let index = 0; index < items.length; index += 1) {
            totalHeight += getEstimatedModuleHeight(items[index], openModuleMap[items[index].module_id] ?? true);
            if (index < items.length - 1) {
                totalHeight += MODULE_SECTION_GAP;
            }
        }

        return {
            topSpacer,
            bottomSpacer: Math.max(0, totalHeight - topSpacer - renderedHeight),
            visibleItems: items.slice(visibleStartIndex, visibleEndIndex),
        };
    }, [items, openModuleMap, scrollTop, viewportHeight]);

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
        <div ref={scrollRootRef} className="min-h-0 overflow-y-auto">
            <div className="border-b border-border/60 px-5 py-4">
                <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
            </div>
            <div className="px-5 py-5">
                {windowedModules.topSpacer > 0 ? <div aria-hidden="true" style={{ height: `${windowedModules.topSpacer}px` }} /> : null}
                <div className="space-y-4">
                    {windowedModules.visibleItems.map((moduleItem) => (
                        <CanvasModuleSection
                            key={moduleItem.module_id}
                            courseId={courseId}
                            moduleItem={moduleItem}
                            isOpen={openModuleMap[moduleItem.module_id] ?? true}
                            onOpenChange={(nextOpen) => {
                                setOpenModuleMap((currentMap) => ({
                                    ...currentMap,
                                    [moduleItem.module_id]: nextOpen,
                                }));
                            }}
                            onOpenPage={onOpenPage}
                            courseExternalId={courseExternalId}
                            canvasOrigin={canvasOrigin}
                        />
                    ))}
                </div>
                {windowedModules.bottomSpacer > 0 ? <div aria-hidden="true" style={{ height: `${windowedModules.bottomSpacer}px` }} /> : null}
            </div>
        </div>
    );
};
