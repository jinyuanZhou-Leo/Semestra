import { useState, useEffect, useCallback, useRef } from 'react';
import type { WidgetItem } from '../components/widgets/DashboardGrid';
import api from '../services/api';
import type { Widget } from '../services/api';
import { WidgetRegistry, type WidgetContext, canAddWidget } from '../services/widgetRegistry';
import { reportError } from '../services/appStatus';
import { MAX_RETRY_ATTEMPTS, getRetryDelayMs, isRetryableError } from '../services/retryPolicy';

const toWidgetItem = (widget: Widget): WidgetItem => {
    let parsedSettings = {};
    let parsedLayout = undefined;
    try {
        parsedSettings = JSON.parse(widget.settings || '{}');
        parsedLayout = JSON.parse(widget.layout_config || '{}');
    } catch (e) {
        console.warn("Failed to parse widget settings/layout", widget.id, e);
    }
    return {
        id: widget.id.toString(),
        type: widget.widget_type,
        title: widget.title,
        settings: parsedSettings,
        layout: parsedLayout,
        is_removable: widget.is_removable
    };
};

interface UseDashboardWidgetsProps {
    courseId?: string;
    semesterId?: string;
    initialWidgets?: Widget[];
    onRefresh?: () => void;
}

export const useDashboardWidgets = ({ courseId, semesterId, initialWidgets, onRefresh }: UseDashboardWidgetsProps) => {
    const [widgets, setWidgets] = useState<WidgetItem[]>([]);
    const settingsRetryCountsRef = useRef<Map<string, number>>(new Map());
    const layoutRetryCountsRef = useRef<Map<string, number>>(new Map());
    const widgetUpdateSeqRef = useRef<Map<string, number>>(new Map());

    // Track if initial sync has happened to prevent overwriting optimistic UI
    const initialSyncDoneRef = useRef(false);

    // Initialize widgets from props - ONLY on initial load
    // After initial sync, local state is the source of truth (Optimistic UI)
    useEffect(() => {
        // Only sync on initial load, not on subsequent refreshes
        if (initialWidgets && !initialSyncDoneRef.current) {
            const mappedWidgets: WidgetItem[] = initialWidgets.map(toWidgetItem);
            setWidgets(mappedWidgets);
            initialSyncDoneRef.current = true;
        }
    }, [initialWidgets]);

    const addWidget = useCallback(async (type: string) => {
        const context: WidgetContext | null = courseId ? 'course' : (semesterId ? 'semester' : null);
        if (!context) return;

        const definition = WidgetRegistry.get(type);
        if (!definition) {
            console.warn(`Unknown widget type: ${type}`);
            return;
        }

        const currentCount = widgets.filter(w => w.type === type).length;
        if (!canAddWidget(definition, context, currentCount)) {
            console.warn(`Widget type ${type} cannot be added to ${context} or max instances reached.`);
            return;
        }

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
            const mappedWidget = toWidgetItem(newWidget);
            settingsRetryCountsRef.current.delete(mappedWidget.id);
            layoutRetryCountsRef.current.delete(mappedWidget.id);

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
            reportError('Failed to create widget. Please try again.');
        }
    }, [courseId, semesterId, onRefresh, widgets]);

    const removeWidget = useCallback(async (id: string) => {
        if (!window.confirm("Are you sure you want to remove this widget?")) return;

        // Find widget before removing for lifecycle hook
        const widgetToRemove = widgets.find(w => w.id === id);

        // Optimistic update
        const previousWidgets = [...widgets];
        setWidgets(prev => prev.filter(w => w.id !== id));
        settingsRetryCountsRef.current.delete(id);
        layoutRetryCountsRef.current.delete(id);

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
            reportError('Failed to remove widget. Please try again.');
        }
    }, [widgets, onRefresh]);

    const updateWidget = useCallback(async (id: string, data: any) => {
        const nextSeq = (widgetUpdateSeqRef.current.get(id) ?? 0) + 1;
        widgetUpdateSeqRef.current.set(id, nextSeq);
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
            const result = await api.updateWidget(id, data);
            const latestSeq = widgetUpdateSeqRef.current.get(id);
            if (latestSeq === nextSeq) {
                setWidgets(prev => prev.map(w => (w.id === id ? toWidgetItem(result) : w)));
            }
            settingsRetryCountsRef.current.delete(id);
            layoutRetryCountsRef.current.delete(id);
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error("Failed to update widget", error);
            // Revert or refresh? Refreshing is safer
            if (onRefresh) onRefresh();
            reportError('Failed to save widget changes. Please retry.');
        }
    }, [onRefresh]);

    // ============================================================
    // DEBOUNCED WIDGET SETTINGS UPDATE (Framework-level optimization)
    // Plugin developers just call updateSettings, framework handles debouncing
    // ============================================================

    // Refs for debounced settings sync (per-widget)
    const settingsSyncTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const pendingSettingsRef = useRef<Map<string, any>>(new Map());

    /**
     * Flush pending settings for a specific widget
     * Called on blur events and unmount
     * 
     * NOTE: We do NOT call onRefresh here because:
     * 1. Optimistic UI is already correct (local state was updated immediately)
     * 2. Calling refresh would fetch data from server which might be stale
     * 3. This would cause UI to flash back to old state
     */
    const flushWidgetSettings = useCallback(async (widgetId: string) => {
        const timer = settingsSyncTimersRef.current.get(widgetId);
        if (timer) {
            clearTimeout(timer);
            settingsSyncTimersRef.current.delete(widgetId);
        }

        const pending = pendingSettingsRef.current.get(widgetId);
        if (pending) {
            pendingSettingsRef.current.delete(widgetId);
            const nextSeq = (widgetUpdateSeqRef.current.get(widgetId) ?? 0) + 1;
            widgetUpdateSeqRef.current.set(widgetId, nextSeq);
            try {
                const result = await api.updateWidget(widgetId, pending);
                const latestSeq = widgetUpdateSeqRef.current.get(widgetId);
                if (latestSeq === nextSeq && !pendingSettingsRef.current.has(widgetId)) {
                    setWidgets(prev => prev.map(w => (w.id === widgetId ? toWidgetItem(result) : w)));
                }
                settingsRetryCountsRef.current.delete(widgetId);
                // Do NOT call onRefresh - optimistic UI is already correct
                // Calling refresh would overwrite local state with potentially stale server data
            } catch (error) {
                console.error("Failed to sync widget settings", widgetId, error);
                if (!isRetryableError(error)) {
                    reportError('Failed to sync widget settings.');
                    return;
                }
                const attempt = (settingsRetryCountsRef.current.get(widgetId) ?? 0) + 1;
                settingsRetryCountsRef.current.set(widgetId, attempt);
                if (attempt >= MAX_RETRY_ATTEMPTS) {
                    reportError('Failed after retries. Please retry manually.', 0);
                    return;
                }
                reportError('Sync failed. Retrying...');
                pendingSettingsRef.current.set(widgetId, pending);
                const retryTimer = setTimeout(() => {
                    flushWidgetSettings(widgetId);
                }, getRetryDelayMs(attempt));
                settingsSyncTimersRef.current.set(widgetId, retryTimer);
            }
        }
    }, []);

    /**
     * Debounced widget update - for frequent updates like typing
     * OPTIMISTIC UI: Local state updates immediately, API sync is debounced
     * Plugin developers don't need to implement debouncing themselves
     */
    const updateWidgetDebounced = useCallback((id: string, data: any) => {
    // OPTIMISTIC UI: Update local state immediately
        setWidgets(prev => prev.map(w => {
            if (w.id === id) {
                if (data.settings) {
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
                return { ...w, ...data };
            }
            return w;
        }));

        // Queue for debounced API sync
        pendingSettingsRef.current.set(id, data);
        settingsRetryCountsRef.current.delete(id);

        // Clear existing timer for this widget
        const existingTimer = settingsSyncTimersRef.current.get(id);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Set new debounced sync (300ms)
        const timer = setTimeout(() => {
            flushWidgetSettings(id);
        }, 300);
        settingsSyncTimersRef.current.set(id, timer);
    }, [flushWidgetSettings]);

    // Cleanup all pending settings on unmount
    useEffect(() => {
        return () => {
            // Flush all pending settings
            settingsSyncTimersRef.current.forEach((timer) => {
                clearTimeout(timer);
            });
            pendingSettingsRef.current.forEach(async (data, widgetId) => {
                try {
                    const result = await api.updateWidget(widgetId, data);
                    setWidgets(prev => prev.map(w => (w.id === widgetId ? toWidgetItem(result) : w)));
                    settingsRetryCountsRef.current.delete(widgetId);
                } catch (error) {
                    console.error("Failed to flush widget settings on unmount", widgetId, error);
                    reportError('Failed to sync widget settings. Please retry.');
                }
            });
            pendingSettingsRef.current.clear();
            settingsSyncTimersRef.current.clear();
        };
    }, []);

    // Refs for debounced layout sync
    const layoutSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingLayoutsRef = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());

    /**
     * Sync pending layouts to API immediately
     * Called when flushing pending updates
     */
    const syncLayoutsToApi = useCallback(async () => {
        if (pendingLayoutsRef.current.size === 0) return;
        if (layoutSyncTimerRef.current) {
            clearTimeout(layoutSyncTimerRef.current);
            layoutSyncTimerRef.current = null;
        }

        const layouts = Array.from(pendingLayoutsRef.current.entries());
        pendingLayoutsRef.current.clear();

        for (const [widgetId, layout] of layouts) {
            try {
                const nextSeq = (widgetUpdateSeqRef.current.get(widgetId) ?? 0) + 1;
                widgetUpdateSeqRef.current.set(widgetId, nextSeq);
                const result = await api.updateWidget(widgetId, { layout_config: JSON.stringify(layout) });
                const latestSeq = widgetUpdateSeqRef.current.get(widgetId);
                if (latestSeq === nextSeq && !pendingLayoutsRef.current.has(widgetId)) {
                    setWidgets(prev => prev.map(w => (w.id === widgetId ? toWidgetItem(result) : w)));
                }
                layoutRetryCountsRef.current.delete(widgetId);
            } catch (error) {
                console.error("Failed to update widget layout", widgetId, error);
                if (!isRetryableError(error)) {
                    reportError('Failed to sync widget layout.');
                    continue;
                }
                const attempt = (layoutRetryCountsRef.current.get(widgetId) ?? 0) + 1;
                layoutRetryCountsRef.current.set(widgetId, attempt);
                if (attempt >= MAX_RETRY_ATTEMPTS) {
                    reportError('Failed after retries. Please retry manually.', 0);
                    continue;
                }
                reportError('Sync failed. Retrying...');
                pendingLayoutsRef.current.set(widgetId, layout);
            }
        }

        if (pendingLayoutsRef.current.size > 0 && !layoutSyncTimerRef.current) {
            layoutSyncTimerRef.current = setTimeout(() => {
                syncLayoutsToApi();
            }, 1000);
        }
    }, []);

    /**
     * Flush pending layout updates immediately
     * Called on unmount to ensure data is saved
     */
    const flushPendingLayouts = useCallback(() => {
        if (layoutSyncTimerRef.current) {
            clearTimeout(layoutSyncTimerRef.current);
            layoutSyncTimerRef.current = null;
        }
        // Sync immediately (fire and forget for unmount scenario)
        syncLayoutsToApi();
    }, [syncLayoutsToApi]);

    // Cleanup on unmount - flush immediately
    useEffect(() => {
        return () => {
            flushPendingLayouts();
        };
    }, [flushPendingLayouts]);

    const updateLayout = useCallback((layouts: any[]) => {
        const widgetById = new Map(widgets.map(w => [w.id, w]));
        const layoutById = new Map(layouts.map(layout => [layout.i, layout]));
        // OPTIMISTIC UI: Update local state immediately for smooth UX
        setWidgets(prev => prev.map(w => {
            const layout = layoutById.get(w.id);
            if (layout) {
                const def = WidgetRegistry.get(w.type);
                const layoutDef = def?.layout || { minW: 2, minH: 2 };
                const minW = layoutDef.minW || 2;
                const minH = layoutDef.minH || 2;
                const safeW = Math.max(layout.w, minW);
                const safeH = Math.max(layout.h, minH);
                const nextLayout = { x: layout.x, y: layout.y, w: safeW, h: safeH };
                return { ...w, layout: nextLayout };
            }
            return w;
        }));

        // Queue layout changes for debounced API sync
        layouts.forEach(layout => {
            const widget = widgetById.get(layout.i);
            const def = widget ? WidgetRegistry.get(widget.type) : undefined;
            const layoutDef = def?.layout || { minW: 2, minH: 2 };
            const minW = layoutDef.minW || 2;
            const minH = layoutDef.minH || 2;
            const safeW = Math.max(layout.w, minW);
            const safeH = Math.max(layout.h, minH);
            const newLayout = { x: layout.x, y: layout.y, w: safeW, h: safeH };
            pendingLayoutsRef.current.set(layout.i, newLayout);
            layoutRetryCountsRef.current.delete(layout.i);
        });

        // Debounce API sync (500ms to allow rapid drag/resize without API spam)
        if (layoutSyncTimerRef.current) {
            clearTimeout(layoutSyncTimerRef.current);
        }
        layoutSyncTimerRef.current = setTimeout(() => {
            syncLayoutsToApi();
        }, 500);
    }, [syncLayoutsToApi, widgets]);

    return {
        widgets,
        addWidget,
        removeWidget,
        updateWidget,
        updateWidgetDebounced,  // For frequent updates (typing)
        flushWidgetSettings,     // For plugins to flush on blur
        updateLayout
    };
};
