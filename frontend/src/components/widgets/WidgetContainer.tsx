import React from 'react';

interface WidgetContainerProps {
    id: string; // Unique ID
    children: React.ReactNode;
    onRemove?: () => void;
    onEdit?: () => void;
    title?: string;
    isSaving?: boolean;
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({ children, onRemove, onEdit, title, isSaving }) => {
    const style: React.CSSProperties = {
        backgroundColor: 'var(--color-bg-primary)',
        borderRadius: '0.75rem', // Increased radius
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--color-border)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
    };

    return (
        <div style={style}>
            {/* Header / Drag Handle */}
            <div
                className="drag-handle noselect"
                style={{
                    padding: '0.4rem 1rem', // Reduced padding for smaller height
                    borderBottom: '1px solid var(--color-border)',
                    cursor: 'grab',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'var(--color-bg-tertiary)',
                    borderTopLeftRadius: '0.75rem', // Matched increased radius
                    borderTopRightRadius: '0.75rem', // Matched increased radius
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{title || 'Widget'}</span>
                    {isSaving && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Saving...</span>}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {onEdit && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit();
                            }}
                            onPointerDown={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
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
                            onMouseDown={e => e.stopPropagation()}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', fontSize: '1.2rem', lineHeight: 1 }}
                        >
                            &times;
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div
                className="nodrag"
                style={{ flex: 1, padding: '1rem', overflow: 'hidden' }}
                onMouseDown={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
};
