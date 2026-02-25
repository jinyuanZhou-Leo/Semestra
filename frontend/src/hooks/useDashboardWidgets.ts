// input:  [widget CRUD APIs, `WidgetRegistry`, plugin metadata/layout resolvers, layout normalization utilities, retry/status helpers, context guards]
// output: [`useDashboardWidgets()` state/actions with split local layout sync, commit persistence, and context-safe synchronization]
// pos:    [Core widget orchestration hook for dashboard creation, update, remove, and two-phase layout synchronization]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
    DeviceLayoutMode,
    WidgetItem,
    WidgetLayout,
    WidgetResponsiveLayout
} from '../components/widgets/DashboardGrid';
import type { Layout } from 'react-grid-layout';
import api from '../services/api';
import type { Widget } from '../services/api';
import { WidgetRegistry, type WidgetContext, canAddWidget } from '../services/widgetRegistry';
import { clearSyncRetryAction, registerSyncRetryAction, reportError } from '../services/appStatus';
import { MAX_RETRY_ATTEMPTS, getRetryDelayMs, isRetryableError } from '../services/retryPolicy';
import {
    ensureWidgetPluginByTypeLoaded,
    getResolvedWidgetLayoutByType,
    getResolvedWidgetMetadataByType,
} from '../plugin-system';
import {
    normalizeLayoutX,
    normalizeLayoutY,
    normalizeWidgetSize,
    resolveWidgetLayoutConstraints
} from '../utils/widgetLayout';

const getWidgetSettingsRetryKey = (widgetId: string) => `widget-settings:${widgetId}`;
const getWidgetLayoutRetryKey = (widgetId: string) => `widget-layout:${widgetId}`;

const isWidgetLayout = (value: unknown): value is WidgetLayout => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.x === 'number' &&
        typeof candidate.y === 'number' &&
        typeof candidate.w === 'number' &&
        typeof candidate.h === 'number'
    );
};

const normalizeResponsiveLayout = (value: unknown): WidgetResponsiveLayout | undefined => {
    if (!value || typeof value !== 'object') return undefined;

    if (isWidgetLayout(value)) {
        return {
            desktop: { ...value },
            mobile: { ...value }
        };
    }

    const record = value as Record<string, unknown>;
    const desktop = isWidgetLayout(record.desktop) ? { ...record.desktop } : undefined;
    const mobile = isWidgetLayout(record.mobile) ? { ...record.mobile } : undefined;

    if (!desktop && !mobile) return undefined;
    return { desktop, mobile };
};

const mergeLayoutByDevice = (
    current: WidgetResponsiveLayout | undefined,
    deviceMode: DeviceLayoutMode,
    nextLayout: WidgetLayout
): WidgetResponsiveLayout => {
    const normalized = current ? { ...current } : {};
    return {
        ...normalized,
        [deviceMode]: nextLayout
    };
};

const pickLayoutByDevice = (
    layout: WidgetResponsiveLayout | undefined,
    deviceMode: DeviceLayoutMode
): WidgetLayout | undefined => {
    if (!layout) return undefined;
    if (deviceMode === 'desktop') {
        return layout.desktop ?? layout.mobile;
    }
    return layout.mobile ?? layout.desktop;
};

const isSameWidgetLayout = (
    left: WidgetLayout | undefined,
    right: WidgetLayout | undefined
): boolean => {
    if (!left && !right) return true;
    if (!left || !right) return false;
    return left.x === right.x && left.y === right.y && left.w === right.w && left.h === right.h;
};

const sanitizeWidgetLayout = (
    layout: { x: unknown; y: unknown; w: unknown; h: unknown },
    widgetType: string,
    maxCols: number
): WidgetLayout => {
    const constraints = resolveWidgetLayoutConstraints(getResolvedWidgetLayoutByType(widgetType), maxCols);
    const { w: safeW, h: safeH } = normalizeWidgetSize(layout.w, layout.h, constraints);
    return {
        x: normalizeLayoutX(layout.x, maxCols, safeW),
        y: normalizeLayoutY(layout.y),
        w: safeW,
        h: safeH
    };
};

const toWidgetItem = (widget: Widget): WidgetItem => {
    let parsedSettings = {};
    let parsedLayout: WidgetResponsiveLayout | undefined;
    try {
        parsedSettings = JSON.parse(widget.settings || '{}');
    } catch (error) {
        console.warn('Failed to parse widget settings', widget.id, error);
    }
    try {
        const layoutRaw = JSON.parse(widget.layout_config || '{}');
        parsedLayout = normalizeResponsiveLayout(layoutRaw);
    } catch (error) {
        console.warn('Failed to parse widget layout', widget.id, error);
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
    const syncRetryKeysRef = useRef<Set<string>>(new Set());
    const widgetUpdateSeqRef = useRef<Map<string, number>>(new Map());
    const settingsSyncTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const pendingSettingsRef = useRef<Map<string, any>>(new Map());
    const layoutSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingLayoutsRef = useRef<Map<string, WidgetResponsiveLayout>>(new Map());

    // Track if initial sync has happened to prevent overwriting optimistic UI
    const initialSyncDoneRef = useRef(false);
    const contextKey = courseId ? `course:${courseId}` : (semesterId ? `semester:${semesterId}` : 'none');
    const currentContextKeyRef = useRef(contextKey);
    const contextVersionRef = useRef(0);

    useEffect(() => {
        if (currentContextKeyRef.current === contextKey) return;
        currentContextKeyRef.current = contextKey;
        contextVersionRef.current += 1;

        settingsSyncTimersRef.current.forEach((timer) => clearTimeout(timer));
        settingsSyncTimersRef.current.clear();
        pendingSettingsRef.current.clear();

        if (layoutSyncTimerRef.current) {
            clearTimeout(layoutSyncTimerRef.current);
            layoutSyncTimerRef.current = null;
        }
        pendingLayoutsRef.current.clear();

        widgetUpdateSeqRef.current.clear();
        settingsRetryCountsRef.current.clear();
        layoutRetryCountsRef.current.clear();
        syncRetryKeysRef.current.forEach((key) => clearSyncRetryAction(key));
        syncRetryKeysRef.current.clear();

        initialSyncDoneRef.current = false;
        setWidgets([]);
    }, [contextKey]);

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
        const contextVersion = contextVersionRef.current;
        const context: WidgetContext | null = courseId ? 'course' : (semesterId ? 'semester' : null);
        if (!context) return;

        let pluginLoaded = false;
        try {
            pluginLoaded = await ensureWidgetPluginByTypeLoaded(type);
        } catch (error) {
            console.error(`Failed to load widget plugin for type: ${type}`, error);
            reportError('Failed to load widget plugin. Please try again.');
            return;
        }
        if (!pluginLoaded) {
            console.warn(`No plugin loader found for widget type: ${type}`);
            return;
        }

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
            const metadata = getResolvedWidgetMetadataByType(type);
            const title = metadata.name ?? 'Widget';

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

            if (contextVersionRef.current !== contextVersion) {
                return;
            }

            // Update local state with real widget
            const mappedWidget = toWidgetItem(newWidget);
            settingsRetryCountsRef.current.delete(mappedWidget.id);
            layoutRetryCountsRef.current.delete(mappedWidget.id);
            const settingsRetryKey = getWidgetSettingsRetryKey(mappedWidget.id);
            const layoutRetryKey = getWidgetLayoutRetryKey(mappedWidget.id);
            clearSyncRetryAction(settingsRetryKey);
            clearSyncRetryAction(layoutRetryKey);
            syncRetryKeysRef.current.delete(settingsRetryKey);
            syncRetryKeysRef.current.delete(layoutRetryKey);

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

            if (contextVersionRef.current !== contextVersion) {
                return;
            }

            setWidgets(prev => [...prev, mappedWidget]);

            if (onRefresh) onRefresh();

        } catch (error) {
            console.error("Failed to create widget", error);
            reportError('Failed to create widget. Please try again.');
        }
    }, [courseId, semesterId, onRefresh, widgets]);

    const removeWidget = useCallback(async (id: string) => {
        const contextVersion = contextVersionRef.current;
        // Find widget before removing for lifecycle hook
        const widgetToRemove = widgets.find(w => w.id === id);

        // Optimistic update
        const previousWidgets = [...widgets];
        setWidgets(prev => prev.filter(w => w.id !== id));
        settingsRetryCountsRef.current.delete(id);
        layoutRetryCountsRef.current.delete(id);
        const settingsRetryKey = getWidgetSettingsRetryKey(id);
        const layoutRetryKey = getWidgetLayoutRetryKey(id);
        clearSyncRetryAction(settingsRetryKey);
        clearSyncRetryAction(layoutRetryKey);
        syncRetryKeysRef.current.delete(settingsRetryKey);
        syncRetryKeysRef.current.delete(layoutRetryKey);

        try {
            await api.deleteWidget(id);
            if (contextVersionRef.current !== contextVersion) return;

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
            if (contextVersionRef.current !== contextVersion) return;
            // Revert on failure
            setWidgets(previousWidgets);
            reportError('Failed to remove widget. Please try again.');
        }
    }, [widgets, onRefresh, courseId, semesterId]);

    const updateWidget = useCallback(async (id: string, data: any) => {
        const contextVersion = contextVersionRef.current;
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
                            const parsedLayout = JSON.parse(data.layout_config);
                            newLayout = normalizeResponsiveLayout(parsedLayout);
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
            if (contextVersionRef.current !== contextVersion) return;
            const latestSeq = widgetUpdateSeqRef.current.get(id);
            if (latestSeq === nextSeq) {
                setWidgets(prev => prev.map(w => (w.id === id ? toWidgetItem(result) : w)));
            }
            settingsRetryCountsRef.current.delete(id);
            layoutRetryCountsRef.current.delete(id);
            const settingsRetryKey = getWidgetSettingsRetryKey(id);
            const layoutRetryKey = getWidgetLayoutRetryKey(id);
            clearSyncRetryAction(settingsRetryKey);
            clearSyncRetryAction(layoutRetryKey);
            syncRetryKeysRef.current.delete(settingsRetryKey);
            syncRetryKeysRef.current.delete(layoutRetryKey);
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error("Failed to update widget", error);
            if (contextVersionRef.current !== contextVersion) return;
            // Revert or refresh? Refreshing is safer
            if (onRefresh) onRefresh();
            reportError('Failed to save widget changes. Please retry.');
        }
    }, [onRefresh]);

    // ============================================================
    // DEBOUNCED WIDGET SETTINGS UPDATE (Framework-level optimization)
    // Plugin developers just call updateSettings, framework handles debouncing
    // ============================================================

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
        const contextVersion = contextVersionRef.current;
        const retryKey = getWidgetSettingsRetryKey(widgetId);
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
                if (contextVersionRef.current !== contextVersion) return;
                const latestSeq = widgetUpdateSeqRef.current.get(widgetId);
                if (latestSeq === nextSeq && !pendingSettingsRef.current.has(widgetId)) {
                    setWidgets(prev => prev.map(w => (w.id === widgetId ? toWidgetItem(result) : w)));
                }
                settingsRetryCountsRef.current.delete(widgetId);
                clearSyncRetryAction(retryKey);
                syncRetryKeysRef.current.delete(retryKey);
                // Do NOT call onRefresh - optimistic UI is already correct
                // Calling refresh would overwrite local state with potentially stale server data
            } catch (error) {
                if (contextVersionRef.current !== contextVersion) return;
                console.error("Failed to sync widget settings", widgetId, error);
                if (!isRetryableError(error)) {
                    reportError('Failed to sync widget settings.');
                    return;
                }
                const attempt = (settingsRetryCountsRef.current.get(widgetId) ?? 0) + 1;
                settingsRetryCountsRef.current.set(widgetId, attempt);
                if (attempt >= MAX_RETRY_ATTEMPTS) {
                    registerSyncRetryAction(retryKey, () => {
                        if (contextVersionRef.current !== contextVersion) return;
                        settingsRetryCountsRef.current.delete(widgetId);
                        pendingSettingsRef.current.set(widgetId, pending);
                        void flushWidgetSettings(widgetId);
                    });
                    syncRetryKeysRef.current.add(retryKey);
                    reportError('Sync failed after retries. Please retry manually.', 0);
                    return;
                }
                clearSyncRetryAction(retryKey);
                syncRetryKeysRef.current.delete(retryKey);
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
        const retryKey = getWidgetSettingsRetryKey(id);
        clearSyncRetryAction(retryKey);
        syncRetryKeysRef.current.delete(retryKey);

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
        const settingsSyncTimers = settingsSyncTimersRef.current;
        const pendingSettings = pendingSettingsRef.current;
        const settingsRetryCounts = settingsRetryCountsRef.current;
        const syncRetryKeys = syncRetryKeysRef.current;

        return () => {
            // Flush all pending settings
            settingsSyncTimers.forEach((timer) => {
                clearTimeout(timer);
            });
            pendingSettings.forEach(async (data, widgetId) => {
                try {
                    await api.updateWidget(widgetId, data);
                    settingsRetryCounts.delete(widgetId);
                    const retryKey = getWidgetSettingsRetryKey(widgetId);
                    clearSyncRetryAction(retryKey);
                    syncRetryKeys.delete(retryKey);
                } catch (error) {
                    console.error("Failed to flush widget settings on unmount", widgetId, error);
                    reportError('Failed to sync widget settings. Please retry.');
                }
            });
            pendingSettings.clear();
            settingsSyncTimers.clear();
        };
    }, []);

    /**
     * Sync pending layouts to API immediately
     * Called when flushing pending updates
     */
    const syncLayoutsToApi = useCallback(async () => {
        const contextVersion = contextVersionRef.current;
        if (pendingLayoutsRef.current.size === 0) return;
        if (layoutSyncTimerRef.current) {
            clearTimeout(layoutSyncTimerRef.current);
            layoutSyncTimerRef.current = null;
        }

        const layouts = Array.from(pendingLayoutsRef.current.entries());
        pendingLayoutsRef.current.clear();

        await Promise.all(layouts.map(async ([widgetId, layoutConfig]) => {
            const retryKey = getWidgetLayoutRetryKey(widgetId);
            try {
                const nextSeq = (widgetUpdateSeqRef.current.get(widgetId) ?? 0) + 1;
                widgetUpdateSeqRef.current.set(widgetId, nextSeq);
                const result = await api.updateWidget(widgetId, { layout_config: JSON.stringify(layoutConfig) });
                if (contextVersionRef.current !== contextVersion) return;
                const latestSeq = widgetUpdateSeqRef.current.get(widgetId);
                if (latestSeq === nextSeq && !pendingLayoutsRef.current.has(widgetId)) {
                    setWidgets(prev => prev.map(w => (w.id === widgetId ? toWidgetItem(result) : w)));
                }
                layoutRetryCountsRef.current.delete(widgetId);
                clearSyncRetryAction(retryKey);
                syncRetryKeysRef.current.delete(retryKey);
            } catch (error) {
                if (contextVersionRef.current !== contextVersion) return;
                console.error("Failed to update widget layout", widgetId, error);
                if (!isRetryableError(error)) {
                    reportError('Failed to sync widget layout.');
                    return;
                }
                const attempt = (layoutRetryCountsRef.current.get(widgetId) ?? 0) + 1;
                layoutRetryCountsRef.current.set(widgetId, attempt);
                if (attempt >= MAX_RETRY_ATTEMPTS) {
                    registerSyncRetryAction(retryKey, () => {
                        if (contextVersionRef.current !== contextVersion) return;
                        layoutRetryCountsRef.current.delete(widgetId);
                        pendingLayoutsRef.current.set(widgetId, layoutConfig);
                        void syncLayoutsToApi();
                    });
                    syncRetryKeysRef.current.add(retryKey);
                    reportError('Sync failed after retries. Please retry manually.', 0);
                    return;
                }
                clearSyncRetryAction(retryKey);
                syncRetryKeysRef.current.delete(retryKey);
                reportError('Sync failed. Retrying...');
                pendingLayoutsRef.current.set(widgetId, layoutConfig);
            }
        }));

        if (contextVersionRef.current !== contextVersion) return;

        if (pendingLayoutsRef.current.size > 0 && !layoutSyncTimerRef.current) {
            const maxAttempt = Math.max(
                ...Array.from(pendingLayoutsRef.current.keys()).map((id) => layoutRetryCountsRef.current.get(id) ?? 1)
            );
            layoutSyncTimerRef.current = setTimeout(() => {
                syncLayoutsToApi();
            }, getRetryDelayMs(maxAttempt));
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

    const updateLayout = useCallback((layouts: Layout, deviceMode: DeviceLayoutMode, maxCols: number) => {
        const effectiveMaxCols = Math.max(1, maxCols);
        const layoutById = new Map(layouts.map((layout) => [layout.i, layout]));

        // Local in-memory sync for responsive reflow and immediate UI consistency.
        setWidgets((prev) => {
            let hasChanges = false;
            const next = prev.map((widget) => {
                const rawLayout = layoutById.get(widget.id);
                if (!rawLayout) return widget;

                const nextLayout = sanitizeWidgetLayout(rawLayout, widget.type, effectiveMaxCols);
                const previousDeviceLayout = pickLayoutByDevice(widget.layout, deviceMode);
                if (isSameWidgetLayout(previousDeviceLayout, nextLayout)) {
                    return widget;
                }

                hasChanges = true;
                return {
                    ...widget,
                    layout: mergeLayoutByDevice(widget.layout, deviceMode, nextLayout)
                };
            });
            return hasChanges ? next : prev;
        });
    }, []);

    const commitLayout = useCallback((layouts: Layout, deviceMode: DeviceLayoutMode, maxCols: number) => {
        const effectiveMaxCols = Math.max(1, maxCols);
        const widgetById = new Map(widgets.map((widget) => [widget.id, widget]));
        let hasQueuedChange = false;

        // Queue only the widgets that actually changed for the active device layout.
        layouts.forEach((layout) => {
            const widget = widgetById.get(layout.i);
            if (!widget) return;

            const newLayout = sanitizeWidgetLayout(layout, widget.type, effectiveMaxCols);
            const queuedLayout = pendingLayoutsRef.current.get(layout.i);
            const baseLayout = queuedLayout ?? widget.layout;
            const previousDeviceLayout = pickLayoutByDevice(baseLayout, deviceMode);
            if (isSameWidgetLayout(previousDeviceLayout, newLayout)) return;

            const nextResponsiveLayout = mergeLayoutByDevice(baseLayout, deviceMode, newLayout);
            pendingLayoutsRef.current.set(layout.i, nextResponsiveLayout);
            layoutRetryCountsRef.current.delete(layout.i);
            const retryKey = getWidgetLayoutRetryKey(layout.i);
            clearSyncRetryAction(retryKey);
            syncRetryKeysRef.current.delete(retryKey);
            hasQueuedChange = true;
        });

        if (!hasQueuedChange) return;

        // Debounce API sync (500ms to allow rapid drag/resize without API spam).
        if (layoutSyncTimerRef.current) {
            clearTimeout(layoutSyncTimerRef.current);
        }
        layoutSyncTimerRef.current = setTimeout(() => {
            syncLayoutsToApi();
        }, 500);
    }, [syncLayoutsToApi, widgets]);

    useEffect(() => {
        const syncRetryKeys = syncRetryKeysRef.current;
        return () => {
            syncRetryKeys.forEach((key) => clearSyncRetryAction(key));
            syncRetryKeys.clear();
        };
    }, []);

    return {
        widgets,
        addWidget,
        removeWidget,
        updateWidget,
        updateWidgetDebounced,  // For frequent updates (typing)
        flushWidgetSettings,     // For plugins to flush on blur
        updateLayout,
        commitLayout
    };
};
