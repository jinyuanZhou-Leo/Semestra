// input:  [tab items, active selection, add/remove/reorder callbacks, shadcn tabs primitives, drag/confirm UI events, non-passive wheel-to-horizontal-scroll gestures, and workspace-nav width constraints]
// output: [`Tabs` component and `TabItem` interface]
// pos:    [Dashboard/homepage tab selector that composes shadcn Tabs with horizontal scrolling, drag-sort, add/remove controls, overflow shadows, and stable right-aligned workspace navigation layout]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import { Button } from '@/components/ui/button';
import {
    Tabs as ShadcnTabs,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Plus, X } from 'lucide-react';

export interface TabItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
    removable?: boolean;
    draggable?: boolean;
}

interface TabsProps {
    items: TabItem[];
    activeId: string;
    onSelect: (id: string) => void;
    onRemove?: (id: string) => void;
    onReorder?: (ids: string[]) => void;
    onAdd?: () => void;
}

const reorderIds = (ids: string[], fromId: string, toId: string) => {
    const fromIndex = ids.indexOf(fromId);
    const toIndex = ids.indexOf(toId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return ids;
    const next = [...ids];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
};

export const Tabs: React.FC<TabsProps> = ({ items, activeId, onSelect, onRemove, onReorder, onAdd }) => {
    const dragIdRef = React.useRef<string | null>(null);
    const scrollRef = React.useRef<HTMLDivElement | null>(null);
    const [draggingId, setDraggingId] = React.useState<string | null>(null);
    const [dragOverId, setDragOverId] = React.useState<string | null>(null);
    const [pendingRemoveId, setPendingRemoveId] = React.useState<string | null>(null);
    const [isRemoving, setIsRemoving] = React.useState(false);
    const [showLeftShadow, setShowLeftShadow] = React.useState(false);
    const [showRightShadow, setShowRightShadow] = React.useState(false);

    const updateScrollShadows = React.useCallback(() => {
        const container = scrollRef.current;
        if (!container) {
            setShowLeftShadow(false);
            setShowRightShadow(false);
            return;
        }

        const maxScrollLeft = container.scrollWidth - container.clientWidth;
        const hasOverflow = maxScrollLeft > 1;
        const nextLeftShadow = hasOverflow && container.scrollLeft > 2;
        const nextRightShadow = hasOverflow && container.scrollLeft < maxScrollLeft - 2;

        setShowLeftShadow((current) => (current === nextLeftShadow ? current : nextLeftShadow));
        setShowRightShadow((current) => (current === nextRightShadow ? current : nextRightShadow));
    }, []);

    React.useEffect(() => {
        updateScrollShadows();
    }, [items, updateScrollShadows]);

    React.useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        updateScrollShadows();
        container.addEventListener('scroll', updateScrollShadows, { passive: true });

        const resizeObserver = new ResizeObserver(() => {
            updateScrollShadows();
        });
        resizeObserver.observe(container);

        return () => {
            container.removeEventListener('scroll', updateScrollShadows);
            resizeObserver.disconnect();
        };
    }, [updateScrollShadows]);

    const pendingRemoveTab = React.useMemo(
        () => items.find((item) => item.id === pendingRemoveId) ?? null,
        [items, pendingRemoveId]
    );

    const confirmRemoveTab = React.useCallback(async () => {
        if (!onRemove || !pendingRemoveId || isRemoving) return;
        setIsRemoving(true);
        try {
            await Promise.resolve(onRemove(pendingRemoveId));
            setPendingRemoveId(null);
        } finally {
            setIsRemoving(false);
        }
    }, [isRemoving, onRemove, pendingRemoveId]);

    const handleWheel = React.useCallback((event: WheelEvent) => {
        const container = scrollRef.current;
        if (!container) {
            return;
        }

        const maxScrollLeft = container.scrollWidth - container.clientWidth;
        if (maxScrollLeft <= 1) {
            return;
        }

        const isVerticalDominant = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
        const delta = isVerticalDominant ? event.deltaY : event.deltaX;
        if (Math.abs(delta) < 1) {
            return;
        }

        if (isVerticalDominant) {
            event.preventDefault();
        }

        const nextScrollLeft = Math.min(maxScrollLeft, Math.max(0, container.scrollLeft + delta));
        if (nextScrollLeft === container.scrollLeft) {
            return;
        }

        container.scrollLeft = nextScrollLeft;
        updateScrollShadows();
    }, [updateScrollShadows]);

    React.useEffect(() => {
        const container = scrollRef.current;
        if (!container) {
            return;
        }

        const nativeWheelHandler = (event: WheelEvent) => {
            handleWheel(event);
        };

        container.addEventListener('wheel', nativeWheelHandler, { passive: false });
        return () => {
            container.removeEventListener('wheel', nativeWheelHandler);
        };
    }, [handleWheel]);

    const handleDragStart = (id: string) => (event: React.DragEvent) => {
        dragIdRef.current = id;
        setDraggingId(id);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
    };

    const handleDragOver = (_id: string, draggable?: boolean) => (event: React.DragEvent) => {
        if (!onReorder || !draggable) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (dragIdRef.current === null) {
            dragIdRef.current = event.dataTransfer.getData('text/plain');
        }
    };

    const handleDrop = (id: string, draggable?: boolean) => (event: React.DragEvent) => {
        if (!onReorder || !draggable) return;
        event.preventDefault();
        const draggedId = dragIdRef.current ?? event.dataTransfer.getData('text/plain');
        if (!draggedId || draggedId === id) return;

        // Ensure both source and target are draggable
        const sourceItem = items.find(i => i.id === draggedId);
        const targetItem = items.find(i => i.id === id);

        if (!sourceItem?.draggable || !targetItem?.draggable) return;

        const orderedIds = reorderIds(items.map(item => item.id), draggedId, id);
        onReorder(orderedIds);
        dragIdRef.current = null;
        setDraggingId(null);
        setDragOverId(null);
    };

    return (
        <div className="flex w-full max-w-full items-center justify-end gap-2 transition-[max-width,width] duration-300 ease-out">
            <ShadcnTabs
                value={activeId}
                onValueChange={onSelect}
                className="w-full max-w-full min-w-0 lg:w-auto"
            >
                <div className="w-full max-w-full min-w-0 transition-[max-width,width] duration-300 ease-out lg:w-auto">
                    <div className="flex h-9 min-w-0 items-center rounded-lg bg-muted p-[3px]">
                        <div className="relative min-w-0 flex-1 overflow-hidden rounded-[calc(theme(borderRadius.lg)-3px)]">
                            <TabsList
                                ref={scrollRef}
                                className="dashboard-tabs-scroll h-full w-full min-w-0 justify-start gap-1 overflow-x-auto overflow-y-hidden no-scrollbar rounded-[inherit] bg-transparent transition-[max-width,width] duration-300 ease-out"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                aria-label="Dashboard Tabs"
                            >
                                <style>{`
                                    .dashboard-tabs-scroll::-webkit-scrollbar {
                                        display: none;
                                    }
                                `}</style>
                                {items.map((item) => {
                                    const isDragging = item.id === draggingId;
                                    const isDragOver = item.id === dragOverId && item.id !== draggingId;
                                    const canDrag = !!item.draggable && !!onReorder;

                                    return (
                                        <div
                                            key={item.id}
                                            className={cn(
                                                'relative shrink-0',
                                                isDragging && 'opacity-50',
                                                isDragOver && 'rounded-md ring-2 ring-primary/20'
                                            )}
                                            draggable={canDrag}
                                            onDragStart={canDrag ? handleDragStart(item.id) : undefined}
                                            onDragOver={canDrag ? handleDragOver(item.id, item.draggable) : undefined}
                                            onDragEnter={
                                                canDrag
                                                    ? () => {
                                                          if (draggingId && item.id !== draggingId) {
                                                              setDragOverId(item.id);
                                                          }
                                                      }
                                                    : undefined
                                            }
                                            onDragLeave={
                                                canDrag
                                                    ? () => {
                                                          if (dragOverId === item.id) setDragOverId(null);
                                                      }
                                                    : undefined
                                            }
                                            onDrop={canDrag ? handleDrop(item.id, item.draggable) : undefined}
                                            onDragEnd={
                                                canDrag
                                                    ? () => {
                                                          dragIdRef.current = null;
                                                          setDraggingId(null);
                                                          setDragOverId(null);
                                                      }
                                                    : undefined
                                            }
                                        >
                                            <TabsTrigger
                                                value={item.id}
                                                className={cn(
                                                    'flex-none',
                                                    canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                                                    onRemove && item.removable && 'pr-7'
                                                )}
                                            >
                                                {item.icon && <span className="mr-2 opacity-70">{item.icon}</span>}
                                                <span className="truncate">{item.label}</span>
                                            </TabsTrigger>
                                            {onRemove && item.removable && (
                                                <button
                                                    type="button"
                                                    aria-label={`Remove ${item.label}`}
                                                    className="absolute top-1/2 right-2 z-10 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-sm opacity-50 transition hover:bg-muted-foreground/20 hover:opacity-100"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setPendingRemoveId(item.id);
                                                    }}
                                                >
                                                    <X className="h-3 w-3" strokeWidth={3} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </TabsList>
                            <div
                                aria-hidden="true"
                                className={cn(
                                    "pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-muted via-muted/80 to-transparent opacity-0 transition-opacity duration-200 ease-out motion-reduce:transition-none",
                                    showLeftShadow ? "opacity-100" : "opacity-0"
                                )}
                            />
                            <div
                                aria-hidden="true"
                                className={cn(
                                    "pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-muted via-muted/80 to-transparent opacity-0 transition-opacity duration-200 ease-out motion-reduce:transition-none",
                                    showRightShadow ? "opacity-100" : "opacity-0"
                                )}
                            />
                        </div>
                        {onAdd && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Add tab"
                                className="h-full flex-none rounded-md text-foreground/60 hover:text-foreground"
                                onClick={onAdd}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </ShadcnTabs>
            <AlertDialog
                open={pendingRemoveId !== null}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen && !isRemoving) {
                        setPendingRemoveId(null);
                    }
                }}
            >
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove tab?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingRemoveTab
                                ? `Are you sure you want to remove "${pendingRemoveTab.label}"?`
                                : 'Are you sure you want to remove this tab?'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                                void confirmRemoveTab();
                            }}
                            disabled={isRemoving}
                        >
                            {isRemoving ? 'Removing...' : 'Remove'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
