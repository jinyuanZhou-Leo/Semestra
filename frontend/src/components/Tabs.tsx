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
        <div className="flex items-center gap-2 max-w-full">
            <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground max-w-full">
                <div
                    className="dashboard-tabs-scroll flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden no-scrollbar"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    role="tablist"
                    aria-label="Dashboard Tabs"
                >
                    <style>{`
                        .dashboard-tabs-scroll::-webkit-scrollbar {
                            display: none;
                        }
                    `}</style>
                    {items.map(item => {
                        const isActive = item.id === activeId;
                        const isDragging = item.id === draggingId;
                        const isDragOver = item.id === dragOverId && item.id !== draggingId;

                        // Only allow drag interactions if item is draggable
                        const canDrag = !!item.draggable && !!onReorder;

                        return (
                            <div
                                key={item.id}
                                role="tab"
                                aria-selected={isActive}
                                className={cn(
                                    "group relative inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
                                    isActive
                                        ? "bg-background text-foreground shadow"
                                        : "hover:bg-background/50 hover:text-foreground",
                                    isDragging && "opacity-50",
                                    isDragOver && "bg-background/50 ring-2 ring-primary/20",
                                    !canDrag && "cursor-default" // Default cursor for fixed tabs? Actually shadcn tabs are usually pointer.
                                )}
                                tabIndex={0}
                                onClick={() => onSelect(item.id)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        onSelect(item.id);
                                    }
                                }}
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
                                {item.icon && <span className="opacity-70 mr-2">{item.icon}</span>}
                                <span className="truncate">{item.label}</span>
                                {onRemove && item.removable && (
                                    <div
                                        role="button"
                                        aria-label={`Remove ${item.label}`}
                                        className={cn(
                                            "ml-1 flex h-4 w-4 items-center justify-center rounded-sm opacity-50 hover:bg-muted-foreground/20 hover:opacity-100",
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
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                {onAdd && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 ml-1 rounded-sm p-0 text-muted-foreground hover:bg-background/50 hover:text-foreground"
                        onClick={onAdd}
                    >
                        <span className="text-lg leading-none">+</span>
                    </Button>
                )}
            </div>
        </div>
    );
};
