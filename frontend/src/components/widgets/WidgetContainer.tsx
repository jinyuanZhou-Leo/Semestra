import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WidgetContainerProps {
    id: string; // Unique ID for DnD
    children: React.ReactNode;
    onRemove?: () => void;
    onEdit?: () => void;
    title?: string;
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({ id, children, onRemove, onEdit, title }) => {
    // ... useSortable ...
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        backgroundColor: 'var(--color-bg-primary)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: isDragging ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
        border: '1px solid var(--color-border)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        opacity: isDragging ? 0.8 : 1,
        zIndex: isDragging ? 100 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={style}>
            {/* Header / Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--color-border)',
                    cursor: 'grab',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'var(--color-bg-tertiary)',
                    borderTopLeftRadius: 'var(--radius-lg)',
                    borderTopRightRadius: 'var(--radius-lg)',
                    userSelect: 'none'
                }}
            >
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{title || 'Widget'}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {onEdit && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();

                                // Call onEdit but we need to ensure we don't trigger drag?
                                // onMouseDown/up propagation might be an issue for dnd-kit handles.
                                // But onClick happens after.
                                onEdit();
                            }}
                            onPointerDown={e => e.stopPropagation()} // Important for dnd-kit to not grab
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', fontSize: '1rem' }}
                        >
                            ⚙️
                        </button>
                    )}
                    {onRemove && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove();
                            }}
                            onPointerDown={e => e.stopPropagation()}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', fontSize: '1.2rem', lineHeight: 1 }}
                        >
                            &times;
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, padding: '1rem', overflow: 'hidden' }}>
                {children}
            </div>
        </div>
    );
};
