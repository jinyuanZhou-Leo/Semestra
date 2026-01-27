import { useState, useEffect, useCallback } from 'react';
import type { WidgetItem } from '../components/widgets/DashboardGrid';
import api from '../services/api';
import type { Widget } from '../services/api';
import { WidgetRegistry } from '../services/widgetRegistry';

interface UseDashboardWidgetsProps {
    courseId?: string;
    semesterId?: string;
    initialWidgets?: Widget[];
    onRefresh?: () => void;
}

export const useDashboardWidgets = ({ courseId, semesterId, initialWidgets, onRefresh }: UseDashboardWidgetsProps) => {
    const [widgets, setWidgets] = useState<WidgetItem[]>([]);

    // Initialize widgets from props
    useEffect(() => {
        if (initialWidgets) {
            const mappedWidgets: WidgetItem[] = initialWidgets.map(w => {
                let parsedSettings = {};
                let parsedLayout = undefined;
                try {
                    parsedSettings = JSON.parse(w.settings || '{}');
                    parsedLayout = JSON.parse(w.layout_config || '{}');
                } catch (e) {
                    console.warn("Failed to parse widget settings/layout", w.id, e);
                }
                return {
                    id: w.id.toString(),
                    type: w.widget_type,
                    title: w.title,
                    settings: parsedSettings,
                    layout: parsedLayout,
                    is_removable: w.is_removable
                };
            });
            setWidgets(mappedWidgets);
        }
    }, [initialWidgets]);

    const addWidget = useCallback(async (type: string) => {
        if (!courseId && !semesterId) return;

        try {
            const title = type === 'course-list' ? 'Courses' : (type === 'counter' ? 'Counter' : 'Widget');

            // Call API first to get real ID
            let newWidget: Widget;
            if (courseId) {
                newWidget = await api.createWidgetForCourse(courseId, {
                    widget_type: type,
                    title: title
                });
            } else {
                newWidget = await api.createWidget(semesterId!, {
                    widget_type: type,
                    title: title
                });
            }

            // Update local state with real widget
            const mappedWidget: WidgetItem = {
                id: newWidget.id.toString(),
                type: newWidget.widget_type,
                title: newWidget.title,
                settings: JSON.parse(newWidget.settings || '{}'),
                layout: JSON.parse(newWidget.layout_config || '{}'),
                is_removable: newWidget.is_removable
            };

            // Call onCreate lifecycle hook
            const definition = WidgetRegistry.get(type);
            if (definition?.onCreate) {
                try {
                    await definition.onCreate({
                        widgetId: newWidget.id.toString(),
                        semesterId,
                        courseId,
                        settings: JSON.parse(newWidget.settings || '{}')
                    });
                } catch (error) {
                    console.error('onCreate hook failed, rolling back widget creation', error);
                    await api.deleteWidget(newWidget.id.toString());
                    throw error;
                }
            }

            setWidgets(prev => [...prev, mappedWidget]);

            if (onRefresh) onRefresh();

        } catch (error) {
            console.error("Failed to create widget", error);
        }
    }, [courseId, semesterId, onRefresh]);

    const removeWidget = useCallback(async (id: string) => {
        if (!window.confirm("Are you sure you want to remove this widget?")) return;

        // Find widget before removing for lifecycle hook
        const widgetToRemove = widgets.find(w => w.id === id);

        // Optimistic update
        const previousWidgets = [...widgets];
        setWidgets(prev => prev.filter(w => w.id !== id));

        try {
            await api.deleteWidget(id);

            // Call onDelete lifecycle hook
            if (widgetToRemove) {
                const definition = WidgetRegistry.get(widgetToRemove.type);
                if (definition?.onDelete) {
                    try {
                        await definition.onDelete({
                            widgetId: id,
                            semesterId,
                            courseId,
                            settings: widgetToRemove.settings
                        });
                    } catch (error) {
                        console.error('onDelete hook failed', error);
                        // Don't affect deletion result, just log
                    }
                }
            }

            if (onRefresh) onRefresh();
        } catch (e) {
            console.error("Failed to delete widget", e);
            // Revert on failure
            setWidgets(previousWidgets);
            alert("Failed to remove widget");
        }
    }, [widgets, onRefresh]);

    const updateWidget = useCallback(async (id: string, data: any) => {
        // Optimistic update
        setWidgets(prev => prev.map(w => {
            if (w.id === id) {
                if (data.settings) {
                    // Check if data.settings is string or object. 
                    // API typically takes string, but frontend state wants object.
                    // The handler usually passes what API needs, so let's handle both or clarify.
                    // Typically local state wants the object version.

                    let newSettings = w.settings;
                    if (typeof data.settings === 'string') {
                        try {
                            newSettings = JSON.parse(data.settings);
                        } catch (e) { console.error("Error parsing settings for optimistic update", e) }
                    } else {
                        newSettings = data.settings;
                    }

                    return { ...w, settings: newSettings };
                }
                // Handle layout updates which might come as part of data but often separate?
                // The `data` here is what we send to API: { settings: string } or { layout_config: string }
                if (data.layout_config) {
                    let newLayout = w.layout;
                    if (typeof data.layout_config === 'string') {
                        try {
                            newLayout = JSON.parse(data.layout_config);
                        } catch (e) { console.error("Error parsing layout for optimistic update", e) }
                    }
                    return { ...w, layout: newLayout }
                }

                return { ...w, ...data };
            }
            return w;
        }));

        try {
            // Ensure API gets stringified JSON if needed
            // The calling code (Modal) usually sends exactly what API expects.
            await api.updateWidget(id, data);
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error("Failed to update widget", error);
            // Revert or refresh? Refreshing is safer
            if (onRefresh) onRefresh();
            else alert("Failed to save changes. Please refresh.");
        }
    }, [onRefresh]);

    const updateLayout = useCallback(async (layouts: any[]) => {
        // Batch local update
        setWidgets(prev => prev.map(w => {
            const layout = layouts.find(l => l.i === w.id);
            if (layout) {
                return { ...w, layout: { x: layout.x, y: layout.y, w: layout.w, h: layout.h } };
            }
            return w;
        }));

        // Batch API update
        for (const layout of layouts) {
            const widget = widgets.find(w => w.id === layout.i);
            if (widget) {
                const newLayout = { x: layout.x, y: layout.y, w: layout.w, h: layout.h };
                // Check against CURRENT state widget, not the captured `widget` (which might be stale if we relied on closure, but `widgets` dep helps).
                // Actually `widgets` in dependency array effectively rebuilds this function, so `widget` found in `widgets` is current.
                // Optimization: Check if actually changed.
                if (JSON.stringify(widget.layout) !== JSON.stringify(newLayout)) {
                    try {
                        await api.updateWidget(widget.id, { layout_config: JSON.stringify(newLayout) });
                    } catch (error) {
                        console.error("Failed to update widget layout", error);
                    }
                }
            }
        }
    }, [widgets]);

    return {
        widgets,
        addWidget,
        removeWidget,
        updateWidget,
        updateLayout
    };
};
