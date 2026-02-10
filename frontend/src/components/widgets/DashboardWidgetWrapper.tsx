import React, { useCallback } from 'react';
import { WidgetContainer } from './WidgetContainer';
import { WidgetRegistry, useWidgetRegistry } from '../../services/widgetRegistry';
import type { WidgetItem } from './DashboardGrid';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ensureWidgetPluginByTypeLoaded, hasWidgetPluginForType } from '../../plugins/runtime';
import { PluginWidgetSkeleton } from '../../plugins/runtime/PluginLoadSkeleton';

interface DashboardWidgetWrapperProps {
    widget: WidgetItem;
    index?: number;
    onRemove?: (id: string) => void;
    onEdit?: (widget: WidgetItem) => void;
    /** For immediate updates (modals, etc.) */
    onUpdateWidget: (id: string, newSettings: any) => Promise<void>;
    /** For frequent updates (typing) - debounced by framework */
    onUpdateWidgetDebounced?: (id: string, newSettings: any) => void;
    semesterId?: string;
    courseId?: string;
    updateCourse?: (updates: any) => void;
    /** Lock widgets to prevent dragging and resizing */
    isLocked?: boolean;
}

/**
 * DashboardWidgetWrapper - Memoized for performance
 * 
 * FRAMEWORK-LEVEL OPTIMIZATION:
 * - Plugins call updateSettings() which uses debounced update by default
 * - Local state updates immediately (Optimistic UI)
 * - API sync is debounced at framework level (300ms)
 * - Plugin developers don't need to implement debouncing themselves
 */
const DashboardWidgetWrapperComponent: React.FC<DashboardWidgetWrapperProps> = ({
    widget,
    onRemove,
    onEdit,
    onUpdateWidget,
    onUpdateWidgetDebounced,
    semesterId,
    courseId,
    updateCourse,
    isLocked = false
}) => {
    // Re-render automatically when widget plugins are registered.
    useWidgetRegistry();

    const [isPluginLoading, setIsPluginLoading] = React.useState(false);
    const WidgetComponent = WidgetRegistry.getComponent(widget.type);
    const widgetDefinition = WidgetRegistry.get(widget.type);
    const isKnownPluginType = hasWidgetPluginForType(widget.type);

    React.useEffect(() => {
        let isActive = true;

        if (WidgetComponent || !isKnownPluginType) {
            setIsPluginLoading(false);
            return () => {
                isActive = false;
            };
        }

        setIsPluginLoading(true);
        void ensureWidgetPluginByTypeLoaded(widget.type)
            .catch((error) => {
                console.error(`Failed to load widget plugin for type: ${widget.type}`, error);
            })
            .finally(() => {
                if (isActive) {
                    setIsPluginLoading(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [WidgetComponent, widget.type, isKnownPluginType]);

    /**
     * updateSettings for plugins - uses debounced update by default
     * This is the function passed to plugins - they just call it and framework handles debouncing
     */
    const handleUpdateSettings = useCallback((newSettings: any) => {
        const settingsData = { settings: JSON.stringify(newSettings) };

        if (onUpdateWidgetDebounced) {
            // Use framework-level debouncing (recommended for frequent updates)
            onUpdateWidgetDebounced(widget.id, settingsData);
        } else {
            // Fallback to immediate update
            onUpdateWidget(widget.id, settingsData);
        }
    }, [widget.id, onUpdateWidget, onUpdateWidgetDebounced]);

    // Memoize handlers passed to WidgetContainer
    const handleRemove = useCallback(() => {
        if (onRemove) onRemove(widget.id);
    }, [onRemove, widget.id]);

    const handleEdit = useCallback(() => {
        if (onEdit) onEdit(widget);
    }, [onEdit, widget]);

    // Render custom header buttons from widget definition
    const headerButtons = React.useMemo(() => {
        if (!widgetDefinition?.headerButtons || widgetDefinition.headerButtons.length === 0) {
            return null;
        }

        return widgetDefinition.headerButtons.map((buttonDef) => {
            const handleClick = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                buttonDef.onClick({
                    widgetId: widget.id,
                    settings: widget.settings || {},
                    semesterId,
                    courseId,
                    updateSettings: handleUpdateSettings
                });
            };

            const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
            const controlSizeClass = isTouchDevice ? 'h-9 w-9 text-base' : 'h-7 w-7 text-sm';

            return (
                <Button
                    key={buttonDef.id}
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleClick}
                    title={buttonDef.title}
                    data-widget-control
                    className={cn(
                        'rounded-full border-border/70 bg-card text-muted-foreground shadow-sm transition',
                        'hover:bg-muted hover:text-foreground',
                        controlSizeClass
                    )}
                >
                    {buttonDef.icon}
                </Button>
            );
        });
    }, [widgetDefinition, widget.id, widget.settings, semesterId, courseId, handleUpdateSettings]);

    if (!WidgetComponent) {
        if (isPluginLoading) {
            return <PluginWidgetSkeleton />;
        }
        return <div>Unknown Widget Type: {widget.type}</div>;
    }

    // Check if widget has a settings component (auto-detect settings availability)
    const hasSettings = !!widgetDefinition?.SettingsComponent;

    return (
        <WidgetContainer
            id={widget.id}
            onRemove={onRemove ? handleRemove : undefined}
            onEdit={onEdit && hasSettings ? handleEdit : undefined}
            headerButtons={headerButtons}
            isLocked={isLocked}
        >
            <WidgetComponent
                widgetId={widget.id}
                settings={widget.settings || {}}
                semesterId={semesterId}
                courseId={courseId}
                updateSettings={handleUpdateSettings}
                updateCourse={updateCourse}
            />
        </WidgetContainer>
    );
};

// Custom comparison function for React.memo
// Only re-render if widget data actually changed
const arePropsEqual = (
    prevProps: DashboardWidgetWrapperProps,
    nextProps: DashboardWidgetWrapperProps
): boolean => {
    // Compare widget id, type, and serialized settings/layout
    if (prevProps.widget.id !== nextProps.widget.id) return false;
    if (prevProps.widget.type !== nextProps.widget.type) return false;
    if (prevProps.semesterId !== nextProps.semesterId) return false;
    if (prevProps.courseId !== nextProps.courseId) return false;

    // Deep compare settings (most frequent change)
    if (prevProps.widget.settings !== nextProps.widget.settings) {
        const prevSettings = JSON.stringify(prevProps.widget.settings);
        const nextSettings = JSON.stringify(nextProps.widget.settings);
        if (prevSettings !== nextSettings) return false;
    }

    // Layout changes don't require child re-render (handled by grid)
    return true;
};

export const DashboardWidgetWrapper = React.memo(DashboardWidgetWrapperComponent, arePropsEqual);
