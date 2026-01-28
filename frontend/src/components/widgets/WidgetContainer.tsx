import React from 'react';

interface WidgetContainerProps {
    id: string; // Unique ID
    children: React.ReactNode;
    onRemove?: () => void;
    onEdit?: () => void;
}

/**
 * WidgetContainer - Memoized for performance
 * Contains the visual wrapper and control buttons for widgets
 */
const WidgetContainerComponent: React.FC<WidgetContainerProps> = ({ children, onRemove, onEdit }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const [isTouchDevice, setIsTouchDevice] = React.useState(false);
    const [isTouchControlsVisible, setIsTouchControlsVisible] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        const media = window.matchMedia('(hover: none), (pointer: coarse)');
        const update = () => {
            const touchCapable = media.matches || navigator.maxTouchPoints > 0;
            setIsTouchDevice(touchCapable);
            if (!touchCapable) setIsTouchControlsVisible(false);
        };
        update();
        if (media.addEventListener) {
            media.addEventListener('change', update);
            return () => media.removeEventListener('change', update);
        }
        media.addListener(update);
        return () => media.removeListener(update);
    }, []);

    React.useEffect(() => {
        if (!isTouchDevice) return;
        const handlePointerDown = (event: PointerEvent) => {
            if (!containerRef.current) return;
            if (containerRef.current.contains(event.target as Node)) return;
            setIsTouchControlsVisible(false);
        };
        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [isTouchDevice]);

    const isInteractiveTarget = (target: EventTarget | null) => {
        if (!(target instanceof HTMLElement)) return false;
        return !!target.closest('button, input, textarea, select, a, [role="button"], [role="link"], [data-widget-control], .drag-surface');
    };

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
    const controlsVisible = isTouchDevice ? isTouchControlsVisible : isHovered;
    const controlSize = isTouchDevice ? 36 : 28;
    const controlsPadding = isTouchDevice ? '0.75rem' : '0.5rem';
    const controlsHeight = isTouchDevice ? '48px' : '40px';

    return (
        <div
            ref={containerRef}
            style={style}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onPointerDown={(event) => {
                if (event.pointerType !== 'touch') return;
                if (isInteractiveTarget(event.target)) return;
                setIsTouchControlsVisible(true);
            }}
        >
            {isTouchDevice && (
                <div
                    className="drag-surface"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '32px',
                        zIndex: 5,
                        cursor: 'grab',
                        touchAction: 'none',
                    }}
                    aria-hidden="true"
                />
            )}
            {/* Controls Overlay - Appears on hover */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: controlsHeight,
                    pointerEvents: controlsVisible ? 'auto' : 'none',
                    zIndex: 10,
                    opacity: controlsVisible ? 1 : 0,
                    transition: 'opacity 0.2s ease-in-out',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: isTouchDevice ? 'flex-end' : 'space-between',
                    padding: controlsPadding,
                }}
            >
                {!isTouchDevice && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', pointerEvents: 'auto' }}>
                        <div
                            className="drag-handle"
                            style={{
                                width: `${controlSize}px`,
                                height: `${controlSize}px`,
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
                                touchAction: 'none',
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
                            data-widget-control
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="8" cy="6" r="2" />
                                <circle cx="16" cy="6" r="2" />
                                <circle cx="8" cy="12" r="2" />
                                <circle cx="16" cy="12" r="2" />
                                <circle cx="8" cy="18" r="2" />
                                <circle cx="16" cy="18" r="2" />
                            </svg>
                        </div>
                    </div>
                )}

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
                            data-widget-control
                            style={{
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-bg-primary)',
                                borderRadius: '50%',
                                width: `${controlSize}px`,
                                height: `${controlSize}px`,
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
                            <svg width={isTouchDevice ? "16" : "14"} height={isTouchDevice ? "16" : "14"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                            data-widget-control
                            style={{
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-bg-primary)',
                                borderRadius: '50%',
                                width: `${controlSize}px`,
                                height: `${controlSize}px`,
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
                            <svg width={isTouchDevice ? "18" : "16"} height={isTouchDevice ? "18" : "16"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    touchAction: 'manipulation',
                }}
                onMouseDown={e => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
};

// Memoize to prevent re-renders when parent updates unrelated state
export const WidgetContainer = React.memo(WidgetContainerComponent);
