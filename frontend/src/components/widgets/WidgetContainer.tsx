import React from 'react';
import { useTouchDevice } from '../../hooks/useTouchDevice';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { cn } from '@/lib/utils';

interface WidgetContainerProps {
    id: string; // Unique ID
    children: React.ReactNode;
    onRemove?: () => void;
    onEdit?: () => void;
    headerButtons?: React.ReactNode; // Custom header buttons from plugin definition
    isLocked?: boolean; // Lock widgets to prevent dragging
}

type PointerHandler = (event: PointerEvent) => void;

const pointerHandlers = new Set<PointerHandler>();
let isPointerListenerAttached = false;

const handleGlobalPointerDown = (event: PointerEvent) => {
    pointerHandlers.forEach(handler => handler(event));
};

const addGlobalPointerHandler = (handler: PointerHandler) => {
    if (!isPointerListenerAttached) {
        document.addEventListener('pointerdown', handleGlobalPointerDown);
        isPointerListenerAttached = true;
    }
    pointerHandlers.add(handler);
};

const removeGlobalPointerHandler = (handler: PointerHandler) => {
    pointerHandlers.delete(handler);
    if (pointerHandlers.size === 0 && isPointerListenerAttached) {
        document.removeEventListener('pointerdown', handleGlobalPointerDown);
        isPointerListenerAttached = false;
    }
};

/**
 * WidgetContainer - Memoized for performance
 * Contains the visual wrapper and control buttons for widgets
 */
const WidgetContainerComponent: React.FC<WidgetContainerProps> = ({ children, onRemove, onEdit, headerButtons, isLocked = false }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const isTouchDevice = useTouchDevice();
    const [isTouchControlsVisible, setIsTouchControlsVisible] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        if (!isTouchDevice) {
            setIsTouchControlsVisible(false);
        }
    }, [isTouchDevice]);

    React.useEffect(() => {
        if (!isTouchDevice) return;
        const handlePointerDown = (event: PointerEvent) => {
            if (!containerRef.current) return;
            if (containerRef.current.contains(event.target as Node)) return;
            setIsTouchControlsVisible(false);
        };
        addGlobalPointerHandler(handlePointerDown);
        return () => removeGlobalPointerHandler(handlePointerDown);
    }, [isTouchDevice]);

    const isInteractiveTarget = (target: EventTarget | null) => {
        if (!(target instanceof HTMLElement)) return false;
        return !!target.closest('button, input, textarea, select, a, [role="button"], [role="link"], [data-widget-control], .drag-surface');
    };

    const controlsVisible = isTouchDevice ? isTouchControlsVisible : isHovered;
    const controlSizeClass = isTouchDevice ? 'h-9 w-9' : 'h-7 w-7';
    const controlsHeightClass = isTouchDevice ? 'h-12' : 'h-10';
    const controlsPaddingClass = isTouchDevice ? 'p-3' : 'p-2';

    return (
        <Card
            ref={containerRef}
            className={cn(
                'group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-widget)] border border-border/60 bg-card shadow-sm transition-[box-shadow,border-color]',
                isHovered && !isTouchDevice ? 'shadow-md border-border/80' : ''
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={(event) => {
                if (!isTouchDevice) return;
                if (isInteractiveTarget(event.target)) return;
                setIsTouchControlsVisible(true);
            }}
        >
            {isTouchDevice && !isLocked && (
                <div
                    className={cn(
                        'drag-surface absolute left-0 right-0 top-0 z-10 flex items-center justify-center',
                        controlsHeightClass
                    )}
                    aria-label="Drag handle"
                    style={{ cursor: 'grab', touchAction: 'none' }}
                >
                    {controlsVisible && (
                        <div className="h-1 w-10 rounded-full bg-muted-foreground/50" />
                    )}
                </div>
            )}
            {/* Controls Overlay - Appears on hover */}
            <div
                className={cn(
                    'absolute left-0 right-0 top-0 z-20 flex items-start transition-opacity',
                    isTouchDevice ? 'justify-end' : 'justify-between',
                    controlsHeightClass,
                    controlsPaddingClass,
                    controlsVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
                )}
                onMouseDown={(event) => {
                    const target = event.target as HTMLElement | null;
                    if (target?.closest('.drag-handle')) return;
                    event.stopPropagation();
                }}
                onPointerDown={(event) => {
                    const target = event.target as HTMLElement | null;
                    if (target?.closest('.drag-handle')) return;
                    event.stopPropagation();
                }}
            >
                {!isTouchDevice && (
                    <div className="flex items-center gap-2">
                        {!isLocked && (
                            <div
                                className={cn(
                                    'drag-handle flex items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground shadow-sm transition',
                                    'hover:bg-muted hover:text-foreground',
                                    controlSizeClass
                                )}
                                title="Drag to move"
                                style={{ cursor: 'grab', touchAction: 'none' }}
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
                        )}
                        {/* Custom header buttons from plugin definition */}
                        {headerButtons}
                    </div>
                )}

                {/* Right side: Action Buttons */}
                <div
                    className="nodrag flex items-center gap-1"
                    onMouseDown={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                >
                    {onEdit && (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Settings"
                            data-widget-control
                            className={cn(
                                'rounded-full border-border/70 bg-card text-muted-foreground shadow-sm transition',
                                'hover:bg-muted hover:text-foreground',
                                controlSizeClass
                            )}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onEdit();
                            }}
                        >
                            <svg width={isTouchDevice ? "16" : "14"} height={isTouchDevice ? "16" : "14"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                        </Button>
                    )}
                    {onRemove && (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Remove Widget"
                            data-widget-control
                            className={cn(
                                'rounded-full border-border/70 bg-card text-muted-foreground shadow-sm transition',
                                'hover:border-destructive hover:bg-destructive hover:text-destructive-foreground',
                                controlSizeClass
                            )}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onRemove();
                            }}
                        >
                            <svg width={isTouchDevice ? "18" : "16"} height={isTouchDevice ? "18" : "16"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </Button>
                    )}
                </div>
            </div>

            {/* Content Area - No padding top, content fills entire widget */}
            <div
                className="nodrag relative z-10 flex-1 overflow-auto p-4"
                onMouseDown={e => e.stopPropagation()}
                style={{ touchAction: 'manipulation' }}
            >
                {children}
            </div>
        </Card>
    );
};

// Custom comparison function to ensure isLocked changes trigger re-renders
const arePropsEqual = (
    prevProps: WidgetContainerProps,
    nextProps: WidgetContainerProps
): boolean => {
    // Always re-render if isLocked changes
    if (prevProps.isLocked !== nextProps.isLocked) return false;

    // Re-render if other key props change
    if (prevProps.id !== nextProps.id) return false;
    if (prevProps.onRemove !== nextProps.onRemove) return false;
    if (prevProps.onEdit !== nextProps.onEdit) return false;
    if (prevProps.headerButtons !== nextProps.headerButtons) return false;
    if (prevProps.children !== nextProps.children) return false;

    return true;
};

// Memoize to prevent re-renders when parent updates unrelated state
export const WidgetContainer = React.memo(WidgetContainerComponent, arePropsEqual);
