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
            {/* Drag Handle Area - Only top area is draggable now */}
            <div
                className="drag-handle"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '40px',
                    zIndex: 5,
                    cursor: 'grab',
                }}
            />

            {/* Controls Overlay */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '40px',
                    pointerEvents: 'none',
                    zIndex: 10, // Above drag handle
                    opacity: isHovered ? 1 : 0,
                    transition: 'opacity 0.2s ease-in-out',
                }}
            >
                {/* Title (Left) */}
                <div
                    className="noselect"
                    style={{
                        position: 'absolute',
                        top: '0.75rem',
                        left: '0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--color-text-tertiary)',
                        maxWidth: 'calc(100% - 90px)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textShadow: '0 1px 2px rgba(255,255,255,0.8)', // Better readability on any bg
                    }}
                >
                    {title || 'Widget'}
                    {isSaving && <span style={{ marginLeft: '0.5rem', fontStyle: 'italic' }}>Saving...</span>}
                </div>

                {/* Buttons (Right) */}
                <div
                    className="nodrag"
                    style={{
                        position: 'absolute',
                        top: '0.5rem',
                        right: '0.5rem',
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
                            {/* Settings Icon (Gear) - Simplified/Corrected */}
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
                                background: 'var(--color-bg-primary)', // Matches settings button
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
                            {/* X Icon */}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area - Added Check for top padding if needed, but since controls are overlay, we might want a bit of top padding if content is crucial at very top. 
                However, usually widgets have some padding. The 40px drag handle is 'transparent' so clicks pass through if z-index is lower than content? 
                NO, drag handle has z-index 5. Content needs to be interactive. 
                But if drag handle covers content, we can't click content in top 40px. 
                Correction: Drag handle at z-index 5 WILL BLOCK clicks to content in that area. 
                This is a trade-off. "Only top area is draggable". 
                If user wants "Avoid component being dragged when operated", usually implies drag handle is separate or specific area.
                So top 40px IS the "header area" logically, just visually transparent. 
            */}
            <div
                style={{
                    flex: 1,
                    padding: '1rem',
                    overflow: 'auto',
                    height: '100%',
                    position: 'relative',
                    zIndex: 1, // Content below drag handle by default? 
                    // If content is below z-index 5, it won't be clickable in top 40px. 
                    // If we want content to be clickable, it must be above drag handle.
                    // But if it's above drag handle, we can't drag it there.
                    // Logic: Top 40px IS reserved for dragging (and controls). 
                    // Content should probably start below or accept that top 40px is for dragging.
                    paddingTop: '2.5rem', // Push content down so it doesn't overlap with the drag zone/controls area too much visually
                }}
            >
                {children}
            </div>
        </div>
    );
};
