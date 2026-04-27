// input:  [Canvas module summary/item APIs returned from the modules list, Canvas page APIs, Canvas file-download proxy routes, configured axios HTTP client, Canvas link helpers, TanStack Query, shadcn alert/button/collapsible/scroll-area primitives, and shared class merging]
// output: [CanvasModulesView presentational component plus private windowed module-section, item-row, and single-surface detail renderers with file-download validation plus list-scroll restoration]
// pos:    [module content renderer for the Canvas integration tab that keeps supported module items in-app, windows offscreen sections, reads inline module item summaries from the modules payload, caches proxied file previews through the configured HTTP client for native rendering, rejects app-shell HTML downloads, scrolls detail views to the top, and restores the module list scroll position after returning from detail]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { AlertCircle, ArrowLeft, ArrowRight, ChevronRight, ExternalLink } from 'lucide-react';

import { AppEmptyState } from '@/components/AppEmptyState';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import api, { type LmsModuleItem, type LmsModuleSummary } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';

import { CANVAS_QUERY_OPTIONS, openExternalUrl } from '../tab-helpers';
import { formatCanvasPageTimestamp, resolveCanvasHref, resolveCanvasPageReference } from '../shared';
import { CanvasHtmlFragment } from './CanvasHtmlFragment';

const normalizeModuleItemType = (value: string | null | undefined) => {
    const normalized = value?.trim().toLowerCase().replace(/\s+/g, '_') ?? '';
    if (!normalized) {
        return '';
    }
    return ({
        sub_header: 'subheader',
        discussion_topic: 'discussion',
        discussiontopics: 'discussion',
        discussiontopic: 'discussion',
        externaltool: 'external_tool',
        externalurl: 'external_url',
    } as const)[normalized] ?? normalized;
};

const isModuleItemExternal = (item: LmsModuleItem) => {
    const itemType = normalizeModuleItemType(item.target_type ?? item.item_type);
    return itemType.includes('external') || itemType.includes('discussion');
};

const MODULE_ROW_HEIGHT_ESTIMATE = 44;
const MODULE_HEADER_HEIGHT_ESTIMATE = 50;
const MODULE_EMPTY_STATE_HEIGHT_ESTIMATE = 72;
const MODULE_SECTION_GAP = 16;
const MODULE_WINDOW_OVERSCAN = 720;
const MODULE_DEFAULT_ITEM_COUNT_ESTIMATE = 6;
const MODULE_DEFAULT_VIEWPORT_HEIGHT = 720;
const FILE_TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml', 'image/svg+xml'];

const getScrollAreaViewport = (host: HTMLDivElement | null) => host?.querySelector<HTMLDivElement>('[data-slot="scroll-area-viewport"]') ?? null;

const buildModuleFileDownloadUrl = (courseId: string, moduleId: string, moduleItemId: string) => (
    `/api/courses/${encodeURIComponent(courseId)}/lms/modules/${encodeURIComponent(moduleId)}/items/${encodeURIComponent(moduleItemId)}/file/download`
);

const normalizeMimeType = (value: string | null | undefined) => value?.trim().toLowerCase().split(';')[0] ?? '';

const isTextLikeMimeType = (mimeType: string) => (
    FILE_TEXT_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))
    || mimeType === 'application/javascript'
    || mimeType === 'application/x-javascript'
    || mimeType === 'application/typescript'
);

const readBlobAsText = async (blob: Blob) => {
    if (typeof blob.text === 'function') {
        return blob.text();
    }

    if (typeof blob.arrayBuffer === 'function') {
        const buffer = await blob.arrayBuffer();
        return new TextDecoder('utf-8').decode(buffer);
    }

    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file text.'));
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.readAsText(blob);
    });
};

const getResponseContentType = (headers: Record<string, unknown>) => {
    const value = headers['content-type'] ?? headers['Content-Type'];
    return typeof value === 'string' ? value : '';
};

type CachedModuleFilePreview = {
    blob: Blob;
    mimeType: string;
    textContent: string | null;
};

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
    onSelectItem: (item: LmsModuleItem) => void;
    canvasOrigin?: string | null;
};

const CanvasModuleItemRow = React.memo(function CanvasModuleItemRow({
    item,
    onSelectItem,
    canvasOrigin,
}: CanvasModuleItemRowProps) {
    const { externalUrl, isExternalItem } = React.useMemo(() => {
        const contentDetails = item.content_details ?? {};
        const fileUrl = typeof contentDetails.url === 'string' ? contentDetails.url : null;
        const resolvedExternalUrl = resolveCanvasHref(
            fileUrl ?? item.external_url ?? item.html_url ?? item.url ?? '',
            canvasOrigin,
        );
        return {
            externalUrl: resolvedExternalUrl,
            isExternalItem: isModuleItemExternal(item),
        };
    }, [canvasOrigin, item]);

    return (
        <button
            type="button"
            className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
            onClick={() => {
                if (isExternalItem) {
                    openExternalUrl(externalUrl);
                    return;
                }
                onSelectItem(item);
            }}
        >
            <div className="min-w-0">
                <p
                    className={cn(
                        'truncate text-sm font-medium text-foreground',
                        isExternalItem ? 'decoration-current underline-offset-4 hover:underline' : '',
                    )}
                >
                    {item.title}
                </p>
            </div>
            {isExternalItem ? <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> : (
                <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            )}
        </button>
    );
});

const CanvasModuleItemDetailLoading: React.FC = () => (
    <div className="flex h-full min-h-0 flex-col">
        <div className="space-y-2 border-b border-border/60 px-5 py-4">
            <Skeleton className="h-4 w-32 rounded-full" />
            <Skeleton className="h-7 w-64 rounded-md" />
        </div>
        <div className="flex-1 px-5 py-5">
            <Skeleton className="h-44 rounded-2xl" />
        </div>
    </div>
);

const CanvasModuleFilePreview: React.FC<{
    courseId: string;
    moduleId: string;
    moduleItemId: string;
    title: string;
    onBack: () => void;
}> = ({ courseId, moduleId, moduleItemId, title, onBack }) => {
    const fileQuery = useQuery<CachedModuleFilePreview>({
        queryKey: queryKeys.courses.lmsModuleFile(courseId, moduleId, moduleItemId),
        queryFn: async () => {
            const response = await axios.get<Blob>(buildModuleFileDownloadUrl(courseId, moduleId, moduleItemId), {
                responseType: 'blob',
            });
            const blob = response.data;
            const mimeType = normalizeMimeType(getResponseContentType(response.headers) || blob.type);
            if (mimeType === 'text/html') {
                throw new Error('The file download returned an HTML page instead of the Canvas file.');
            }
            const textContent = isTextLikeMimeType(mimeType)
                ? await readBlobAsText(blob)
                : null;

            return {
                blob,
                mimeType,
                textContent,
            };
        },
        ...CANVAS_QUERY_OPTIONS,
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 60,
    });

    const [blobUrl, setBlobUrl] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!fileQuery.data || fileQuery.data.textContent !== null) {
            setBlobUrl(null);
            return;
        }

        const createdBlobUrl = URL.createObjectURL(fileQuery.data.blob);
        setBlobUrl(createdBlobUrl);
        return () => {
            URL.revokeObjectURL(createdBlobUrl);
        };
    }, [fileQuery.data]);

    if (fileQuery.isLoading && !fileQuery.data) {
        return <CanvasModuleItemDetailLoading />;
    }

    if (fileQuery.error || !fileQuery.data) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                surface="inherit"
                title="File preview unavailable"
                description={fileQuery.error instanceof Error ? fileQuery.error.message : 'Failed to load the file preview from Semestra.'}
                className="h-full"
            />
        );
    }

    const mimeType = fileQuery.data.mimeType;
    const textContent = fileQuery.data.textContent;
    const previewKind = (() => {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType === 'application/pdf') return 'pdf';
        if (isTextLikeMimeType(mimeType)) return 'text';
        return 'unknown';
    })();

    return (
        <section className="flex h-full min-h-0 flex-col overflow-hidden">
            <header className="space-y-2 border-b border-border/60 px-5 py-4">
                <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" onClick={onBack}>
                    <ArrowLeft className="size-3.5" />
                    Back to modules
                </Button>
                <div className="min-w-0 space-y-1">
                    <h3 className="truncate text-xl font-semibold text-foreground">{title}</h3>
                    <p className="text-sm text-muted-foreground">
                        {previewKind === 'unknown' ? 'File preview' : `${previewKind.charAt(0).toUpperCase() + previewKind.slice(1)} preview`}
                    </p>
                </div>
            </header>
            <div className="min-h-0 flex-1 overflow-auto">
                {previewKind === 'image' && blobUrl ? (
                    <img
                        src={blobUrl}
                        alt={title}
                        className="h-auto w-full object-contain"
                    />
                ) : previewKind === 'video' && blobUrl ? (
                    <video controls className="h-full w-full bg-background" src={blobUrl} />
                ) : previewKind === 'audio' && blobUrl ? (
                    <div className="p-5">
                        <audio controls className="w-full" src={blobUrl} />
                    </div>
                ) : previewKind === 'pdf' && blobUrl ? (
                    <object
                        data={blobUrl}
                        type="application/pdf"
                        aria-label={`${title} preview`}
                        className="h-[72vh] w-full"
                    >
                        <div className="p-5 text-sm text-muted-foreground">
                            Your browser cannot render this PDF inline.
                        </div>
                    </object>
                ) : previewKind === 'text' ? (
                    <pre className="min-h-full bg-muted/20 p-5 text-sm leading-6 text-foreground whitespace-pre-wrap">
                        {textContent || 'This file is empty.'}
                    </pre>
                ) : blobUrl ? (
                    <object
                        data={blobUrl}
                        type={mimeType || undefined}
                        className="h-[72vh] w-full"
                    >
                        <div className="p-5 text-sm text-muted-foreground">
                            Your browser cannot render this file inline.
                        </div>
                    </object>
                ) : (
                    <AppEmptyState
                        scenario="unavailable"
                        size="section"
                        surface="inherit"
                        title="File preview unavailable"
                        description="Semestra could not determine how to render this file inline."
                        className="h-full"
                    />
                )}
            </div>
        </section>
    );
};

const CanvasModuleItemDetail: React.FC<{
    courseId: string;
    moduleId: string;
    moduleItem: LmsModuleItem;
    courseExternalId: string;
    canvasOrigin?: string | null;
    onOpenAssignments?: () => void;
    onOpenQuizzes?: () => void;
    onBack: () => void;
}> = ({ courseId, moduleId, moduleItem, courseExternalId, canvasOrigin, onOpenAssignments, onOpenQuizzes, onBack }) => {
    const detailItemType = normalizeModuleItemType(moduleItem.target_type ?? moduleItem.item_type);
    const resolvedPageRef = React.useMemo(
        () => moduleItem.page_url ?? resolveCanvasPageReference(moduleItem.html_url ?? moduleItem.url ?? '', courseExternalId, canvasOrigin),
        [canvasOrigin, courseExternalId, moduleItem.html_url, moduleItem.page_url, moduleItem.url],
    );
    const [activePageRef, setActivePageRef] = React.useState<string | null>(detailItemType === 'page' ? resolvedPageRef : null);
    const isPageItem = detailItemType === 'page' && Boolean(activePageRef);

    React.useEffect(() => {
        setActivePageRef(detailItemType === 'page' ? resolvedPageRef : null);
    }, [detailItemType, resolvedPageRef, moduleItem.module_item_id]);

    const pageQuery = useQuery({
        queryKey: courseId && activePageRef ? queryKeys.courses.lmsPage(courseId, activePageRef) : ['courses', 'lms-page', 'disabled', courseId, moduleItem.module_item_id],
        queryFn: () => api.getCourseLmsPage(courseId, activePageRef!),
        enabled: Boolean(activePageRef && isPageItem),
        ...CANVAS_QUERY_OPTIONS,
    });

    if (isPageItem) {
        if (pageQuery.isLoading && !pageQuery.data) {
            return <CanvasModuleItemDetailLoading />;
        }

        if (pageQuery.error || !pageQuery.data) {
            return (
                <AppEmptyState
                    scenario="unavailable"
                    size="section"
                    surface="inherit"
                    title="Canvas page unavailable"
                    description="Failed to load the selected Canvas page."
                    className="h-full"
                />
            );
        }

        return (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <div className="border-b border-border/60 px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                            <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" onClick={onBack}>
                                <ArrowLeft className="size-3.5" />
                                Back to modules
                            </Button>
                            <h3 className="text-xl font-semibold text-foreground">{pageQuery.data.title}</h3>
                            <p className="text-sm text-muted-foreground">
                                Updated {formatCanvasPageTimestamp(pageQuery.data.updated_at)}
                            </p>
                        </div>
                    </div>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                    <div className="px-5 py-5">
                        {pageQuery.data.locked_for_user && pageQuery.data.lock_explanation ? (
                            <Alert className="mb-4">
                                <AlertCircle className="size-4" />
                                <AlertTitle>Locked in Canvas</AlertTitle>
                                <AlertDescription>{pageQuery.data.lock_explanation}</AlertDescription>
                            </Alert>
                        ) : null}

                        {pageQuery.data.body ? (
                            <CanvasHtmlFragment
                                body={pageQuery.data.body}
                                courseExternalId={courseExternalId}
                                canvasOrigin={canvasOrigin}
                                onNavigateToPage={(nextPageRef) => setActivePageRef(nextPageRef)}
                            />
                        ) : (
                            <p className="text-sm text-muted-foreground">This page does not have any visible content.</p>
                        )}
                    </div>
                </ScrollArea>
            </div>
        );
    }

    if (detailItemType === 'file') {
        return (
            <CanvasModuleFilePreview
                courseId={courseId}
                moduleId={moduleId}
                moduleItemId={moduleItem.module_item_id}
                title={moduleItem.title}
                onBack={onBack}
            />
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-border/60 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                        <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" onClick={onBack}>
                            <ArrowLeft className="size-3.5" />
                            Back to modules
                        </Button>
                        <h3 className="text-xl font-semibold text-foreground">{moduleItem.title}</h3>
                    </div>
                </div>
            </div>

            <div className="px-5 py-5">
                {(detailItemType.includes('assignment') && onOpenAssignments) || (detailItemType.includes('quiz') && onOpenQuizzes) ? (
                    <div className="flex flex-wrap gap-2">
                        {detailItemType.includes('assignment') && onOpenAssignments ? (
                            <Button type="button" variant="outline" size="sm" onClick={onOpenAssignments}>
                                Open Assignments
                            </Button>
                        ) : null}
                        {detailItemType.includes('quiz') && onOpenQuizzes ? (
                            <Button type="button" variant="outline" size="sm" onClick={onOpenQuizzes}>
                                Open Quizzes
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

type CanvasModuleSectionBodyProps = {
    moduleItem: LmsModuleSummary;
    onSelectItem: (moduleId: string, item: LmsModuleItem) => void;
    canvasOrigin?: string | null;
};

const CanvasModuleSectionBody = React.memo(function CanvasModuleSectionBody({
    moduleItem,
    onSelectItem,
    canvasOrigin,
}: CanvasModuleSectionBodyProps) {
    const estimatedHeight = React.useMemo(
        () => getEstimatedModuleBodyHeight(moduleItem),
        [moduleItem],
    );

    const resolvedItems = moduleItem.items ?? [];

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
            ) : resolvedItems.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">Canvas did not return any visible module items for this section.</p>
            ) : (
                <div className="divide-y divide-border/60">
                    {resolvedItems.map((item) => (
                        <div
                            key={item.module_item_id}
                            className="last:[&>button]:rounded-b-2xl"
                        >
                            <CanvasModuleItemRow
                                item={item}
                                onSelectItem={(selectedItem) => onSelectItem(moduleItem.module_id, selectedItem)}
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
    moduleItem: LmsModuleSummary;
    isOpen: boolean;
    onOpenChange: (nextOpen: boolean) => void;
    onSelectItem: (moduleId: string, item: LmsModuleItem) => void;
    canvasOrigin?: string | null;
};

const CanvasModuleSection = React.memo(function CanvasModuleSection({
    moduleItem,
    isOpen,
    onOpenChange,
    onSelectItem,
    canvasOrigin,
}: CanvasModuleSectionProps) {
    const handleOpenChange = React.useCallback((nextOpen: boolean) => {
        React.startTransition(() => {
            onOpenChange(nextOpen);
        });
    }, [onOpenChange]);

    return (
        <div>
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
                        moduleItem={moduleItem}
                        onSelectItem={onSelectItem}
                        canvasOrigin={canvasOrigin}
                    />
                ) : null}
            </Collapsible>
        </div>
    );
});

export const CanvasModulesView: React.FC<{
    courseId: string;
    heading: string;
    items: LmsModuleSummary[];
    courseExternalId: string;
    canvasOrigin?: string | null;
    onOpenAssignments?: () => void;
    onOpenQuizzes?: () => void;
}> = ({ courseId, heading, items, courseExternalId, canvasOrigin, onOpenAssignments, onOpenQuizzes }) => {
    const scrollAreaHostRef = React.useRef<HTMLDivElement | null>(null);
    const listScrollTopRef = React.useRef(0);
    const [scrollTop, setScrollTop] = React.useState(0);
    const [viewportHeight, setViewportHeight] = React.useState(MODULE_DEFAULT_VIEWPORT_HEIGHT);
    const [selectedModuleItem, setSelectedModuleItem] = React.useState<{ moduleId: string; item: LmsModuleItem } | null>(null);
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
        setSelectedModuleItem(null);
    }, [courseId]);

    React.useEffect(() => {
        const host = scrollAreaHostRef.current;
        const viewport = getScrollAreaViewport(host);
        if (!viewport) {
            return;
        }

        let frameId: number | null = null;
        const syncViewport = () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
            frameId = window.requestAnimationFrame(() => {
                frameId = null;
                setScrollTop(viewport.scrollTop);
                setViewportHeight(viewport.clientHeight || MODULE_DEFAULT_VIEWPORT_HEIGHT);
            });
        };

        syncViewport();
        viewport.addEventListener('scroll', syncViewport, { passive: true });
        window.addEventListener('resize', syncViewport);

        return () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
            viewport.removeEventListener('scroll', syncViewport);
            window.removeEventListener('resize', syncViewport);
        };
    }, []);

    const restoreListScrollPosition = React.useCallback(() => {
        if (typeof window === 'undefined') {
            return;
        }
        window.requestAnimationFrame(() => {
            const viewport = getScrollAreaViewport(scrollAreaHostRef.current);
            if (!viewport) {
                return;
            }
            viewport.scrollTop = listScrollTopRef.current;
            setScrollTop(listScrollTopRef.current);
        });
    }, []);

    React.useEffect(() => {
        if (!selectedModuleItem || typeof window === 'undefined') {
            return;
        }
        window.requestAnimationFrame(() => {
            const viewport = getScrollAreaViewport(scrollAreaHostRef.current);
            if (!viewport) {
                return;
            }
            viewport.scrollTop = 0;
            setScrollTop(0);
        });
    }, [selectedModuleItem]);

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
        <div ref={scrollAreaHostRef} className="min-h-0 h-full">
            <ScrollArea className="h-full min-h-0">
                <div className="border-b border-border/60 px-5 py-4">
                    <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
                </div>
                {selectedModuleItem ? (
                    <CanvasModuleItemDetail
                        courseId={courseId}
                        moduleId={selectedModuleItem.moduleId}
                        moduleItem={selectedModuleItem.item}
                        courseExternalId={courseExternalId}
                        canvasOrigin={canvasOrigin}
                        onOpenAssignments={onOpenAssignments}
                        onOpenQuizzes={onOpenQuizzes}
                        onBack={() => {
                            setSelectedModuleItem(null);
                            restoreListScrollPosition();
                        }}
                    />
                ) : (
                    <div className="px-5 py-5">
                        {windowedModules.topSpacer > 0 ? <div aria-hidden="true" style={{ height: `${windowedModules.topSpacer}px` }} /> : null}
                        <div className="space-y-4">
                            {windowedModules.visibleItems.map((moduleItem) => (
                                <CanvasModuleSection
                                    key={moduleItem.module_id}
                                    moduleItem={moduleItem}
                                    isOpen={openModuleMap[moduleItem.module_id] ?? true}
                                    onOpenChange={(nextOpen) => {
                                        setOpenModuleMap((currentMap) => ({
                                            ...currentMap,
                                            [moduleItem.module_id]: nextOpen,
                                        }));
                                    }}
                                    onSelectItem={(selectedModuleId, item) => {
                                        listScrollTopRef.current = getScrollAreaViewport(scrollAreaHostRef.current)?.scrollTop ?? 0;
                                        setSelectedModuleItem({ moduleId: selectedModuleId, item });
                                    }}
                                    canvasOrigin={canvasOrigin}
                                />
                            ))}
                        </div>
                        {windowedModules.bottomSpacer > 0 ? <div aria-hidden="true" style={{ height: `${windowedModules.bottomSpacer}px` }} /> : null}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
};
