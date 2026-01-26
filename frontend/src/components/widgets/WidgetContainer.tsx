import React from 'react';

interface WidgetContainerProps {
    id: string; // Unique ID
    children: React.ReactNode;
    onRemove?: () => void;
    onEdit?: () => void;
    isSaving?: boolean;
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({ children, onRemove, onEdit, isSaving }) => {
    const [isHovered, setIsHovered] = React.useState(false);

    const style: React.CSSProperties = {
        backgroundColor: 'var(--color-bg-primary)',
        borderRadius: '0.75rem',
        boxShadow: isHovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        border: isHovered ? '1px solid var(--color-text-tertiary)' : '1px solid var(--color-border)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        overflow: 'hidden',
    };

    return (
        <div
            style={style}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Controls Overlay - Appears on hover */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '40px',
                    pointerEvents: 'none',
                    zIndex: 10,
                    opacity: isHovered ? 1 : 0,
                    transition: 'opacity 0.2s ease-in-out',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    padding: '0.5rem',
                }}
            >
                {/* Left side: Drag Handle Icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', pointerEvents: 'auto' }}>
                    {/* Drag Handle Icon */}
                    <div
                        className="drag-handle"
                        style={{
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'grab',
                            color: 'var(--color-text-tertiary)',
                            borderRadius: '50%',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-primary)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            transition: 'all 0.1s',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                            e.currentTarget.style.color = 'var(--color-text-tertiary)';
                        }}
                        title="Drag to move"
                    >
                        {/* Grip Icon (6 dots) */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="8" cy="6" r="2" />
                            <circle cx="16" cy="6" r="2" />
                            <circle cx="8" cy="12" r="2" />
                            <circle cx="16" cy="12" r="2" />
                            <circle cx="8" cy="18" r="2" />
                            <circle cx="16" cy="18" r="2" />
                        </svg>
                    </div>
                    {isSaving && (
                        <span className="noselect" style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--color-text-tertiary)' }}>
                            Saving...
                        </span>
                    )}
                </div>

                {/* Right side: Action Buttons */}
                <div
                    className="nodrag"
                    style={{
                        display: 'flex',
                        gap: '0.25rem',
                        pointerEvents: 'auto',
                    }}
                    onMouseDown={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                >
                    {onEdit && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onEdit();
                            }}
                            title="Settings"
                            style={{
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-bg-primary)',
                                borderRadius: '50%',
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'var(--color-text-secondary)',
                                transition: 'all 0.1s',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                                e.currentTarget.style.color = 'var(--color-text-primary)';
                                e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                                e.currentTarget.style.color = 'var(--color-text-secondary)';
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                        </button>
                    )}
                    {onRemove && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onRemove();
                            }}
                            title="Remove Widget"
                            style={{
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-bg-primary)',
                                borderRadius: '50%',
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'var(--color-text-tertiary)',
                                transition: 'all 0.1s',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.backgroundColor = 'var(--color-danger)';
                                e.currentTarget.style.borderColor = 'var(--color-danger)';
                                e.currentTarget.style.color = 'white';
                                e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                                e.currentTarget.style.color = 'var(--color-text-tertiary)';
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area - No padding top, content fills entire widget */}
            <div
                className="nodrag"
                style={{
                    flex: 1,
                    padding: '1rem',
                    overflow: 'auto',
                    height: '100%',
                    position: 'relative',
                    zIndex: 1,
                }}
                onMouseDown={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
};

