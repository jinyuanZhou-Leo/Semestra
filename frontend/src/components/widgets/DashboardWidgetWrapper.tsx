import React, { useCallback } from 'react';
import { WidgetContainer } from './WidgetContainer';
import { WidgetRegistry } from '../../services/widgetRegistry';
import type { WidgetItem } from './DashboardGrid';

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
    updateCourseField?: (field: string, value: any) => void;
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
    updateCourseField
}) => {
    const WidgetComponent = WidgetRegistry.getComponent(widget.type);
    const widgetDefinition = WidgetRegistry.get(widget.type);

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
            const controlSize = isTouchDevice ? 36 : 28;

            return (
                <button
                    key={buttonDef.id}
                    onClick={handleClick}
                    title={buttonDef.title}
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
                        fontSize: isTouchDevice ? '16px' : '14px',
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
                    {buttonDef.icon}
                </button>
            );
        });
    }, [widgetDefinition, widget.id, widget.settings, semesterId, courseId, handleUpdateSettings]);

    if (!WidgetComponent) {
        return <div>Unknown Widget Type: {widget.type}</div>;
    }

    return (
        <WidgetContainer
            id={widget.id}
            onRemove={onRemove ? handleRemove : undefined}
            onEdit={onEdit ? handleEdit : undefined}
            headerButtons={headerButtons}
        >
            <WidgetComponent
                widgetId={widget.id}
                settings={widget.settings || {}}
                semesterId={semesterId}
                courseId={courseId}
                updateSettings={handleUpdateSettings}
                updateCourseField={updateCourseField}
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
