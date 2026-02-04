import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    const [draggingId, setDraggingId] = React.useState<string | null>(null);
    const [dragOverId, setDragOverId] = React.useState<string | null>(null);

    const handleDragStart = (id: string) => (event: React.DragEvent) => {
        dragIdRef.current = id;
        setDraggingId(id);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
    };

    const handleDragOver = () => (event: React.DragEvent) => {
        if (!onReorder) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (dragIdRef.current === null) {
            dragIdRef.current = event.dataTransfer.getData('text/plain');
        }
    };

    const handleDrop = (id: string) => (event: React.DragEvent) => {
        if (!onReorder) return;
        event.preventDefault();
        const draggedId = dragIdRef.current ?? event.dataTransfer.getData('text/plain');
        if (!draggedId || draggedId === id) return;
        const orderedIds = reorderIds(items.map(item => item.id), draggedId, id);
        onReorder(orderedIds);
        dragIdRef.current = null;
        setDraggingId(null);
        setDragOverId(null);
    };

    return (
        <div className="flex items-center gap-3 pt-3">
            <div className="flex w-full items-center gap-2 rounded-full border border-border/60 bg-card p-1.5 shadow-sm">
                <div
                    className="dashboard-tabs-scroll flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden"
                    role="tablist"
                    aria-label="Dashboard Tabs"
                >
                    {items.map(item => {
                        const isActive = item.id === activeId;
                        const isDragging = item.id === draggingId;
                        const isDragOver = item.id === dragOverId && item.id !== draggingId;
                        return (
                            <div
                                key={item.id}
                                role="tab"
                                aria-selected={isActive}
                                className={cn(
                                    "group relative flex select-none items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold tracking-wide transition",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                    isActive
                                        ? "bg-foreground text-background shadow-sm hover:bg-foreground/90"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                    isDragging && "opacity-70 scale-[0.98]",
                                    isDragOver && "ring-2 ring-foreground/40"
                                )}
                                tabIndex={0}
                                onClick={() => onSelect(item.id)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        onSelect(item.id);
                                    }
                                }}
                                draggable={!!item.draggable && !!onReorder}
                                onDragStart={item.draggable && onReorder ? handleDragStart(item.id) : undefined}
                                onDragOver={item.draggable && onReorder ? handleDragOver() : undefined}
                                onDragEnter={
                                    item.draggable && onReorder
                                        ? () => {
                                              if (draggingId && item.id !== draggingId) {
                                                  setDragOverId(item.id);
                                              }
                                          }
                                        : undefined
                                }
                                onDragLeave={
                                    item.draggable && onReorder
                                        ? () => {
                                              if (dragOverId === item.id) setDragOverId(null);
                                          }
                                        : undefined
                                }
                                onDrop={item.draggable && onReorder ? handleDrop(item.id) : undefined}
                                onDragEnd={
                                    item.draggable && onReorder
                                        ? () => {
                                              dragIdRef.current = null;
                                              setDraggingId(null);
                                              setDragOverId(null);
                                          }
                                        : undefined
                                }
                            >
                                {item.icon && <span className="text-base">{item.icon}</span>}
                                <span className="max-w-[12rem] truncate">{item.label}</span>
                                {onRemove && item.removable && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Remove ${item.label}`}
                                        className={cn(
                                            "h-5 w-5 rounded-full p-0 text-current/70 hover:text-current -mr-1",
                                            isActive ? "hover:bg-background/20" : "hover:bg-foreground/10"
                                        )}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onRemove(item.id);
                                        }}
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            width="12"
                                            height="12"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
                {onAdd && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Add tab"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                        onClick={onAdd}
                    >
                        +
                    </Button>
                )}
            </div>
        </div>
    );
};
