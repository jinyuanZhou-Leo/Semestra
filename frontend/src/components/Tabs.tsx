import React from 'react';

export interface TabItem {
    id: string;
    label: string;
    icon?: string;
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

    const handleDragStart = (id: string) => (event: React.DragEvent) => {
        dragIdRef.current = id;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
    };

    const handleDragOver = (id: string) => (event: React.DragEvent) => {
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
    };

    return (
        <div className="tabs-bar">
            <div className="tabs-list" role="tablist" aria-label="Dashboard Tabs">
                {items.map(item => {
                    const isActive = item.id === activeId;
                    return (
                        <div
                            key={item.id}
                            role="tab"
                            aria-selected={isActive}
                            className={`tab-button ${isActive ? 'active' : ''}`}
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
                            onDragOver={item.draggable && onReorder ? handleDragOver(item.id) : undefined}
                            onDrop={item.draggable && onReorder ? handleDrop(item.id) : undefined}
                        >
                            {item.icon && <span className="tab-icon" aria-hidden="true">{item.icon}</span>}
                            <span className="tab-label">{item.label}</span>
                            {onRemove && item.removable && (
                                <button
                                    type="button"
                                    className="tab-remove"
                                    aria-label={`Remove ${item.label}`}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onRemove(item.id);
                                    }}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
            {onAdd && (
                <button type="button" className="tab-add" onClick={onAdd}>
                    + Add Tab
                </button>
            )}
        </div>
    );
};
