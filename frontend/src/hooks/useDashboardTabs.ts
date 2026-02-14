"use no memo";

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import type { Tab } from '../services/api';
import { TabRegistry, type TabContext, canAddTab } from '../services/tabRegistry';
import { clearSyncRetryAction, registerSyncRetryAction, reportError } from '../services/appStatus';
import { MAX_RETRY_ATTEMPTS, getRetryDelayMs, isRetryableError } from '../services/retryPolicy';
import { ensureTabPluginByTypeLoaded } from '../plugin-system';

export interface TabItem {
    id: string;
    type: string;
    title: string;
    settings?: any;
    order_index: number;
    is_removable?: boolean;
    is_draggable?: boolean;
}

interface UseDashboardTabsProps {
    courseId?: string;
    semesterId?: string;
    initialTabs?: Tab[];
    onRefresh?: () => void;
}

interface AddTabOptions {
    isRemovable?: boolean;
    isDraggable?: boolean;
}

const getTabSettingsRetryKey = (tabId: string) => `tab-settings:${tabId}`;
const getTabOrderRetryKey = (tabId: string) => `tab-order:${tabId}`;

const toTabItem = (tab: Tab): TabItem => {
    let parsedSettings = {};
    try {
        parsedSettings = JSON.parse(tab.settings || '{}');
    } catch (e) {
        console.warn('Failed to parse tab settings', tab.id, e);
    }
    return {
        id: tab.id.toString(),
        type: tab.tab_type,
        title: tab.title,
        settings: parsedSettings,
        order_index: tab.order_index ?? 0,
        is_removable: tab.is_removable,
        is_draggable: tab.is_draggable
    };
};

export const useDashboardTabs = ({ courseId, semesterId, initialTabs, onRefresh }: UseDashboardTabsProps) => {
    const [tabs, setTabs] = useState<TabItem[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const initialSyncDoneRef = useRef(false);
    const tabUpdateSeqRef = useRef<Map<string, number>>(new Map());
    const settingsRetryCountsRef = useRef<Map<string, number>>(new Map());
    const orderRetryCountsRef = useRef<Map<string, number>>(new Map());
    const syncRetryKeysRef = useRef<Set<string>>(new Set());
    const contextKey = courseId ? `course:${courseId}` : (semesterId ? `semester:${semesterId}` : 'none');
    const currentContextKeyRef = useRef(contextKey);

    useEffect(() => {
        if (currentContextKeyRef.current === contextKey) return;
        currentContextKeyRef.current = contextKey;
        syncRetryKeysRef.current.forEach((key) => clearSyncRetryAction(key));
        syncRetryKeysRef.current.clear();
        initialSyncDoneRef.current = false;
        setTabs([]);
        setIsInitialized(false);
    }, [contextKey]);

    useEffect(() => {
        if (initialTabs && !initialSyncDoneRef.current) {
            const mappedTabs: TabItem[] = initialTabs.map(toTabItem).sort((a, b) => a.order_index - b.order_index);
            setTabs(mappedTabs);
            initialSyncDoneRef.current = true;
            setIsInitialized(true);
        }
    }, [initialTabs]);

    const addTab = useCallback(async (type: string, options?: AddTabOptions) => {
        const context: TabContext | null = courseId ? 'course' : (semesterId ? 'semester' : null);
        if (!context) return;

        let pluginLoaded = false;
        try {
            pluginLoaded = await ensureTabPluginByTypeLoaded(type);
        } catch (error) {
            console.error(`Failed to load tab plugin for type: ${type}`, error);
            reportError('Failed to load tab plugin. Please try again.');
            return;
        }
        if (!pluginLoaded) {
            console.warn(`No plugin loader found for tab type: ${type}`);
            return;
        }

        const definition = TabRegistry.get(type);
        if (!definition) {
            console.warn(`Unknown tab type: ${type}`);
            return;
        }

        const currentCount = tabs.filter(t => t.type === type).length;
        if (!canAddTab(definition, context, currentCount)) {
            console.warn(`Tab type ${type} cannot be added to ${context} or max instances reached.`);
            return;
        }

        try {
            const nextOrder = tabs.reduce((max, t) => Math.max(max, t.order_index), -1) + 1;
            const title = definition.name;
            const settings = JSON.stringify(definition.defaultSettings ?? {});

            let newTab: Tab;
            if (courseId) {
                newTab = await api.createTabForCourse(courseId, {
                    tab_type: type,
                    title,
                    settings,
                    order_index: nextOrder,
                    is_removable: options?.isRemovable,
                    is_draggable: options?.isDraggable
                });
            } else {
                newTab = await api.createTab(semesterId!, {
                    tab_type: type,
                    title,
                    settings,
                    order_index: nextOrder,
                    is_removable: options?.isRemovable,
                    is_draggable: options?.isDraggable
                });
            }

            const mappedTab: TabItem = toTabItem(newTab);
            settingsRetryCountsRef.current.delete(mappedTab.id);
            orderRetryCountsRef.current.delete(mappedTab.id);
            const settingsRetryKey = getTabSettingsRetryKey(mappedTab.id);
            const orderRetryKey = getTabOrderRetryKey(mappedTab.id);
            clearSyncRetryAction(settingsRetryKey);
            clearSyncRetryAction(orderRetryKey);
            syncRetryKeysRef.current.delete(settingsRetryKey);
            syncRetryKeysRef.current.delete(orderRetryKey);

            if (definition.onCreate) {
                try {
                    await definition.onCreate({
                        tabId: newTab.id.toString(),
                        semesterId,
                        courseId,
                        settings: JSON.parse(newTab.settings || '{}')
                    });
                } catch (error) {
                    console.error('onCreate hook failed, rolling back tab creation', error);
                    await api.deleteTab(newTab.id.toString());
                    throw error;
                }
            }

            setTabs(prev => [...prev, mappedTab].sort((a, b) => a.order_index - b.order_index));
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Failed to create tab', error);
            reportError('Failed to create tab. Please try again.');
        }
    }, [courseId, semesterId, onRefresh, tabs]);

    const removeTab = useCallback(async (id: string) => {
        const tabToRemove = tabs.find(tab => tab.id === id);
        if (tabToRemove?.is_removable === false) return;
        const previousTabs = [...tabs];
        setTabs(prev => prev.filter(t => t.id !== id));
        settingsRetryCountsRef.current.delete(id);
        orderRetryCountsRef.current.delete(id);
        const settingsRetryKey = getTabSettingsRetryKey(id);
        const orderRetryKey = getTabOrderRetryKey(id);
        clearSyncRetryAction(settingsRetryKey);
        clearSyncRetryAction(orderRetryKey);
        syncRetryKeysRef.current.delete(settingsRetryKey);
        syncRetryKeysRef.current.delete(orderRetryKey);
        try {
            await api.deleteTab(id);
            if (tabToRemove) {
                const definition = TabRegistry.get(tabToRemove.type);
                if (definition?.onDelete) {
                    try {
                        await definition.onDelete({
                            tabId: id,
                            semesterId,
                            courseId,
                            settings: tabToRemove.settings
                        });
                    } catch (error) {
                        console.error('onDelete hook failed', error);
                    }
                }
            }
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Failed to delete tab', error);
            setTabs(previousTabs);
            reportError('Failed to remove tab. Please try again.');
        }
    }, [courseId, semesterId, tabs, onRefresh]);

    const updateTab = useCallback(async (id: string, data: any) => {
        const nextSeq = (tabUpdateSeqRef.current.get(id) ?? 0) + 1;
        tabUpdateSeqRef.current.set(id, nextSeq);
        setTabs(prev => prev.map(t => {
            if (t.id !== id) return t;
            if (data.settings) {
                let newSettings = t.settings;
                if (typeof data.settings === 'string') {
                    try {
                        newSettings = JSON.parse(data.settings);
                    } catch (e) {
                        console.error('Error parsing settings for optimistic tab update', e);
                    }
                } else {
                    newSettings = data.settings;
                }
                return { ...t, settings: newSettings };
            }
            return { ...t, ...data };
        }));
        try {
            const result = await api.updateTab(id, data);
            const latestSeq = tabUpdateSeqRef.current.get(id);
            if (latestSeq === nextSeq) {
                setTabs(prev => prev.map(t => (t.id === id ? toTabItem(result) : t)));
            }
            settingsRetryCountsRef.current.delete(id);
            orderRetryCountsRef.current.delete(id);
            const settingsRetryKey = getTabSettingsRetryKey(id);
            const orderRetryKey = getTabOrderRetryKey(id);
            clearSyncRetryAction(settingsRetryKey);
            clearSyncRetryAction(orderRetryKey);
            syncRetryKeysRef.current.delete(settingsRetryKey);
            syncRetryKeysRef.current.delete(orderRetryKey);
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Failed to update tab', error);
            if (onRefresh) onRefresh();
            reportError('Failed to save tab changes. Please retry.');
        }
    }, [onRefresh]);

    // Debounced settings sync for tabs
    const settingsSyncTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const pendingSettingsRef = useRef<Map<string, any>>(new Map());

    const flushTabSettings = useCallback(async (tabId: string) => {
        const retryKey = getTabSettingsRetryKey(tabId);
        const timer = settingsSyncTimersRef.current.get(tabId);
        if (timer) {
            clearTimeout(timer);
            settingsSyncTimersRef.current.delete(tabId);
        }
        const pending = pendingSettingsRef.current.get(tabId);
        if (pending) {
            pendingSettingsRef.current.delete(tabId);
            const nextSeq = (tabUpdateSeqRef.current.get(tabId) ?? 0) + 1;
            tabUpdateSeqRef.current.set(tabId, nextSeq);
            try {
                const result = await api.updateTab(tabId, pending);
                const latestSeq = tabUpdateSeqRef.current.get(tabId);
                if (latestSeq === nextSeq && !pendingSettingsRef.current.has(tabId)) {
                    setTabs(prev => prev.map(t => (t.id === tabId ? toTabItem(result) : t)));
                }
                settingsRetryCountsRef.current.delete(tabId);
                clearSyncRetryAction(retryKey);
                syncRetryKeysRef.current.delete(retryKey);
            } catch (error) {
                console.error('Failed to sync tab settings', tabId, error);
                if (!isRetryableError(error)) {
                    reportError('Failed to sync tab settings.');
                    return;
                }
                const attempt = (settingsRetryCountsRef.current.get(tabId) ?? 0) + 1;
                settingsRetryCountsRef.current.set(tabId, attempt);
                if (attempt >= MAX_RETRY_ATTEMPTS) {
                    registerSyncRetryAction(retryKey, () => {
                        settingsRetryCountsRef.current.delete(tabId);
                        pendingSettingsRef.current.set(tabId, pending);
                        void flushTabSettings(tabId);
                    });
                    syncRetryKeysRef.current.add(retryKey);
                    reportError('Sync failed after retries. Please retry manually.', 0);
                    return;
                }
                clearSyncRetryAction(retryKey);
                syncRetryKeysRef.current.delete(retryKey);
                reportError('Sync failed. Retrying...');
                pendingSettingsRef.current.set(tabId, pending);
                const retryTimer = setTimeout(() => {
                    flushTabSettings(tabId);
                }, getRetryDelayMs(attempt));
                settingsSyncTimersRef.current.set(tabId, retryTimer);
            }
        }
    }, []);

    const updateTabSettingsDebounced = useCallback((id: string, data: any) => {
        setTabs(prev => prev.map(t => {
            if (t.id === id) {
                if (data.settings) {
                    let newSettings = t.settings;
                    if (typeof data.settings === 'string') {
                        try {
                            newSettings = JSON.parse(data.settings);
                        } catch (e) {
                            console.error('Error parsing settings for optimistic tab update', e);
                        }
                    } else {
                        newSettings = data.settings;
                    }
                    return { ...t, settings: newSettings };
                }
                return { ...t, ...data };
            }
            return t;
        }));

        pendingSettingsRef.current.set(id, data);
        settingsRetryCountsRef.current.delete(id);
        const retryKey = getTabSettingsRetryKey(id);
        clearSyncRetryAction(retryKey);
        syncRetryKeysRef.current.delete(retryKey);
        const existingTimer = settingsSyncTimersRef.current.get(id);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        const timer = setTimeout(() => {
            flushTabSettings(id);
        }, 300);
        settingsSyncTimersRef.current.set(id, timer);
    }, [flushTabSettings]);

    useEffect(() => {
        const settingsSyncTimers = settingsSyncTimersRef.current;
        const pendingSettings = pendingSettingsRef.current;
        const settingsRetryCounts = settingsRetryCountsRef.current;
        const syncRetryKeys = syncRetryKeysRef.current;

        return () => {
            settingsSyncTimers.forEach(timer => clearTimeout(timer));
            pendingSettings.forEach(async (data, tabId) => {
                try {
                    const result = await api.updateTab(tabId, data);
                    setTabs(prev => prev.map(t => (t.id === tabId ? toTabItem(result) : t)));
                    settingsRetryCounts.delete(tabId);
                    const retryKey = getTabSettingsRetryKey(tabId);
                    clearSyncRetryAction(retryKey);
                    syncRetryKeys.delete(retryKey);
                } catch (error) {
                    console.error('Failed to flush tab settings on unmount', tabId, error);
                    reportError('Failed to sync tab settings. Please retry.');
                }
            });
            pendingSettings.clear();
            settingsSyncTimers.clear();
        };
    }, []);

    // Order sync
    const orderSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingOrderRef = useRef<Map<string, number>>(new Map());

    const flushTabOrder = useCallback(async () => {
        if (pendingOrderRef.current.size === 0) return;
        if (orderSyncTimerRef.current) {
            clearTimeout(orderSyncTimerRef.current);
            orderSyncTimerRef.current = null;
        }
        const entries = Array.from(pendingOrderRef.current.entries());
        pendingOrderRef.current.clear();
        for (const [id, order_index] of entries) {
            const retryKey = getTabOrderRetryKey(id);
            try {
                const nextSeq = (tabUpdateSeqRef.current.get(id) ?? 0) + 1;
                tabUpdateSeqRef.current.set(id, nextSeq);
                const result = await api.updateTab(id, { order_index });
                const latestSeq = tabUpdateSeqRef.current.get(id);
                if (latestSeq === nextSeq && !pendingOrderRef.current.has(id)) {
                    setTabs(prev => prev.map(t => (t.id === id ? toTabItem(result) : t)));
                }
                orderRetryCountsRef.current.delete(id);
                clearSyncRetryAction(retryKey);
                syncRetryKeysRef.current.delete(retryKey);
            } catch (error) {
                console.error('Failed to sync tab order', error);
                if (!isRetryableError(error)) {
                    reportError('Failed to sync tab order.');
                    continue;
                }
                const attempt = (orderRetryCountsRef.current.get(id) ?? 0) + 1;
                orderRetryCountsRef.current.set(id, attempt);
                if (attempt >= MAX_RETRY_ATTEMPTS) {
                    registerSyncRetryAction(retryKey, () => {
                        orderRetryCountsRef.current.delete(id);
                        pendingOrderRef.current.set(id, order_index);
                        void flushTabOrder();
                    });
                    syncRetryKeysRef.current.add(retryKey);
                    reportError('Sync failed after retries. Please retry manually.', 0);
                    continue;
                }
                clearSyncRetryAction(retryKey);
                syncRetryKeysRef.current.delete(retryKey);
                reportError('Sync failed. Retrying...');
                pendingOrderRef.current.set(id, order_index);
            }
        }

        if (pendingOrderRef.current.size > 0 && !orderSyncTimerRef.current) {
            const maxAttempt = Math.max(
                ...Array.from(pendingOrderRef.current.keys()).map(id => orderRetryCountsRef.current.get(id) ?? 1)
            );
            orderSyncTimerRef.current = setTimeout(() => {
                flushTabOrder();
            }, getRetryDelayMs(maxAttempt));
        }
    }, []);

    const reorderTabs = useCallback((orderedIds: string[]) => {
        const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
        setTabs(prev => prev.map(t => {
            const nextOrder = orderMap.get(t.id);
            if (nextOrder === undefined) return t;
            return { ...t, order_index: nextOrder };
        }).sort((a, b) => a.order_index - b.order_index));

        orderedIds.forEach((id, index) => {
            pendingOrderRef.current.set(id, index);
            orderRetryCountsRef.current.delete(id);
            const retryKey = getTabOrderRetryKey(id);
            clearSyncRetryAction(retryKey);
            syncRetryKeysRef.current.delete(retryKey);
        });

        if (orderSyncTimerRef.current) {
            clearTimeout(orderSyncTimerRef.current);
        }
        orderSyncTimerRef.current = setTimeout(() => {
            flushTabOrder();
        }, 300);
    }, [flushTabOrder]);

    useEffect(() => {
        return () => {
            if (orderSyncTimerRef.current) {
                clearTimeout(orderSyncTimerRef.current);
            }
            flushTabOrder();
        };
    }, [flushTabOrder]);

    useEffect(() => {
        const syncRetryKeys = syncRetryKeysRef.current;
        return () => {
            syncRetryKeys.forEach((key) => clearSyncRetryAction(key));
            syncRetryKeys.clear();
        };
    }, []);

    return {
        tabs,
        isInitialized,
        addTab,
        removeTab,
        updateTab,
        updateTabSettingsDebounced,
        flushTabSettings,
        reorderTabs
    };
};
