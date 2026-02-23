// input:  [widget action callbacks, touch-device signal, shared pointer-listener coordination]
// output: [`WidgetContainer` component]
// pos:    [Widget chrome shell controlling drag handle and action-button visibility behavior]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { useTouchDevice } from '../../hooks/useTouchDevice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Ellipsis, GripVertical, Settings, X } from 'lucide-react';

interface WidgetContainerProps {
    id: string; // Unique ID
    children: React.ReactNode;
    onRemove?: () => void;
    onEdit?: () => void;
    headerButtons?: React.ReactNode; // Custom header buttons from plugin definition
    isEditMode?: boolean; // Enable edit mode for widget actions
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
const WidgetContainerComponent: React.FC<WidgetContainerProps> = ({ children, onRemove, onEdit, headerButtons, isEditMode = false }) => {
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
        if (!isEditMode) {
            setIsTouchControlsVisible(false);
        }
    }, [isEditMode]);

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

    React.useEffect(() => {
        if (!isTouchDevice || !isTouchControlsVisible) return;
        const timer = window.setTimeout(() => {
            setIsTouchControlsVisible(false);
        }, 2400);
        return () => window.clearTimeout(timer);
    }, [isTouchDevice, isTouchControlsVisible]);

    const isInteractiveTarget = (target: EventTarget | null) => {
        if (!(target instanceof HTMLElement)) return false;
        return !!target.closest('button, input, textarea, select, a, [role="button"], [role="link"], [data-widget-control], .drag-surface');
    };

    const controlsVisible = isTouchDevice ? isTouchControlsVisible : isHovered;
    const controlSizeClass = isTouchDevice ? 'h-9 w-9' : 'h-7 w-7';
    const controlsHeightClass = isTouchDevice ? 'h-12' : 'h-10';

    const handleLeftControlPointerDown = (event: React.MouseEvent | React.PointerEvent) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('.drag-handle')) {
            return;
        }
        event.stopPropagation();
    };

    return (
        <Card
            ref={containerRef}
            className={cn(
                'group relative flex h-full select-none flex-col overflow-hidden rounded-[var(--radius-widget)] border border-border/60 bg-card shadow-sm transition-[box-shadow,border-color]',
                'p-0', // Override Card's default padding so widget content can fully control layout
                isHovered && !isTouchDevice ? 'shadow-md border-border/80' : ''
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={(event) => {
                if (!isTouchDevice) return;
                if (!isEditMode) return;
                if (isInteractiveTarget(event.target)) return;
                setIsTouchControlsVisible(false);
            }}
        >
            {isEditMode && (
                <>
                    <div
                        data-widget-corner-left
                        className={cn(
                            'pointer-events-none absolute top-2 left-2 z-20 flex items-start gap-2',
                            controlsHeightClass
                        )}
                    >
                        <div
                            className={cn(
                                'flex items-center gap-2 pointer-events-none'
                            )}
                            onMouseDown={handleLeftControlPointerDown}
                            onPointerDown={handleLeftControlPointerDown}
                        >
                            <div
                                className={cn(
                                    isTouchDevice ? 'drag-surface' : 'drag-handle',
                                    'flex items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground shadow-sm transition',
                                    'hover:bg-muted hover:text-foreground',
                                    controlSizeClass,
                                    controlsVisible ? 'opacity-100 pointer-events-auto' : (isTouchDevice ? 'opacity-0 pointer-events-none' : 'opacity-55 pointer-events-auto')
                                )}
                                title="Drag to move"
                                style={{ cursor: 'grab', touchAction: 'none' }}
                            >
                                <GripVertical className="h-3.5 w-3.5" />
                            </div>
                            {controlsVisible && (
                                <div className="pointer-events-auto flex items-center gap-1">
                                    {/* Custom header buttons from plugin definition */}
                                    {headerButtons}
                                </div>
                            )}
                        </div>
                    </div>

                    <div
                        data-widget-corner-right
                        className={cn(
                            'pointer-events-none absolute top-2 right-2 z-20 flex items-start gap-1',
                            controlsHeightClass
                        )}
                    >
                        {isTouchDevice && (
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                title="Widget actions"
                                data-widget-control
                                className={cn(
                                    'rounded-full border-border/70 bg-background text-muted-foreground shadow-sm transition',
                                    'hover:bg-muted hover:text-foreground',
                                    controlSizeClass,
                                    'pointer-events-auto'
                                )}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsTouchControlsVisible((prev) => !prev);
                                }}
                            >
                                <Ellipsis className="h-4 w-4" />
                            </Button>
                        )}
                        {onEdit && (
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                title="Settings"
                                data-widget-control
                                className={cn(
                                    'rounded-full border-border/70 bg-background text-muted-foreground shadow-sm transition',
                                    'hover:bg-muted hover:text-foreground',
                                    controlSizeClass,
                                    controlsVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
                                )}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onEdit();
                                }}
                            >
                                <Settings className={isTouchDevice ? "h-4 w-4" : "h-3.5 w-3.5"} />
                            </Button>
                        )}
                        {onRemove && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        title="Remove Widget"
                                        data-widget-control
                                        className={cn(
                                            'rounded-full text-destructive shadow-sm transition',
                                            controlSizeClass,
                                            controlsVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
                                        )}
                                        style={{
                                            backgroundColor: 'var(--destructive-soft-bg)',
                                            borderWidth: '1px',
                                            borderStyle: 'solid',
                                            borderColor: 'var(--destructive-soft-border)',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'var(--destructive-soft-bg-hover)';
                                            e.currentTarget.style.borderColor = 'var(--destructive-soft-border-hover)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'var(--destructive-soft-bg)';
                                            e.currentTarget.style.borderColor = 'var(--destructive-soft-border)';
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                        }}
                                    >
                                        <X className={isTouchDevice ? "h-4.5 w-4.5" : "h-4 w-4"} />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent size="sm">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Remove this widget?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            variant="destructive"
                                            onClick={() => {
                                                onRemove();
                                            }}
                                        >
                                            Remove
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </>
            )}

            {/* Content Area - No padding top, content fills entire widget */}
            <div
                className="nodrag relative z-10 flex-1 overflow-auto"
                onMouseDown={e => e.stopPropagation()}
                style={{ touchAction: 'manipulation' }}
            >
                {children}
            </div>
        </Card>
    );
};

// Custom comparison function to ensure edit mode changes trigger re-renders
const arePropsEqual = (
    prevProps: WidgetContainerProps,
    nextProps: WidgetContainerProps
): boolean => {
    // Always re-render if edit mode changes
    if (prevProps.isEditMode !== nextProps.isEditMode) return false;

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
