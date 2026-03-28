// input:  [runtime tab settings/order APIs, initial resolved tab payloads from semester/course detail, normalized governance adapters, and retry/status helpers]
// output: [`TabItem` type and `useDashboardTabs()` state/actions for Program->Semester governed runtime tabs]
// pos:    [Runtime tab orchestration hook that treats semester/course tabs as governed API state instead of locally created plugin instances]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { GovernedRuntimeTab } from '../plugin-system/runtimeGovernance';
import api, { type RuntimeResolvedTab, type Tab } from '../services/api';
import { reportError } from '../services/appStatus';

export interface TabItem {
    id: string;
    type: string;
    title: string;
    settings?: Record<string, unknown>;
    order_index: number;
    is_removable?: boolean;
    is_draggable?: boolean;
    source: 'governed' | 'legacy' | 'synthetic';
}

interface UseDashboardTabsProps {
    courseId?: string;
    semesterId?: string;
    orderOwnerSemesterId?: string;
    initialTabs?: Array<Tab | RuntimeResolvedTab | GovernedRuntimeTab>;
    governed?: boolean;
    onRefresh?: () => void;
}

const parseSettingsObject = (rawSettings: unknown): Record<string, unknown> => {
    if (!rawSettings) return {};
    if (typeof rawSettings === 'string') {
        try {
            const parsed = JSON.parse(rawSettings);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? parsed as Record<string, unknown>
                : {};
        } catch (error) {
            console.warn('Failed to parse tab settings payload', error);
            return {};
        }
    }

    if (typeof rawSettings === 'object' && !Array.isArray(rawSettings)) {
        return rawSettings as Record<string, unknown>;
    }

    return {};
};

const toTabItem = (
    tab: Tab | RuntimeResolvedTab | GovernedRuntimeTab,
    scopeKey: string,
    index: number,
    governed: boolean
): TabItem | null => {
    const type = 'tab_type' in tab ? tab.tab_type : tab.type;
    if (!type) return null;

    const id = ('id' in tab && typeof tab.id === 'string' && tab.id.length > 0)
        ? tab.id
        : `${scopeKey}:${type}`;
    const title = ('title' in tab && typeof tab.title === 'string' && tab.title.length > 0)
        ? tab.title
        : type;
    const settings = 'resolved_settings' in tab
        ? parseSettingsObject(tab.resolved_settings ?? tab.settings)
        : parseSettingsObject(tab.settings);

    return {
        id,
        type,
        title,
        settings,
        order_index: typeof tab.order_index === 'number' ? tab.order_index : index,
        is_removable: tab.is_removable,
        is_draggable: tab.is_draggable,
        source: governed ? 'governed' : 'legacy',
    };
};

const stringifySettings = (settings: Record<string, unknown>) => JSON.stringify(settings ?? {});

export const useDashboardTabs = ({
    courseId,
    semesterId,
    orderOwnerSemesterId,
    initialTabs,
    governed = true,
    onRefresh,
}: UseDashboardTabsProps) => {
    const [tabs, setTabs] = useState<TabItem[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const tabsRef = useRef<TabItem[]>([]);
    const settingsTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const pendingSettingsRef = useRef<Map<string, Record<string, unknown>>>(new Map());
    const orderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingOrderedIdsRef = useRef<string[] | null>(null);

    const scopeKey = courseId ? `course:${courseId}` : `semester:${semesterId ?? 'unknown'}`;
    const normalizedInitialTabs = useMemo(() => (
        (initialTabs ?? [])
            .map((tab, index) => toTabItem(tab, scopeKey, index, governed))
            .filter((tab): tab is TabItem => tab !== null)
            .sort((left, right) => left.order_index - right.order_index)
    ), [governed, initialTabs, scopeKey]);

    useEffect(() => {
        tabsRef.current = tabs;
    }, [tabs]);

    useEffect(() => {
        setTabs(normalizedInitialTabs);
        tabsRef.current = normalizedInitialTabs;
        setIsInitialized(true);
    }, [normalizedInitialTabs]);

    const addTab = useCallback(async () => {
        reportError('Tabs are governed by Program and Semester settings.');
    }, []);

    const removeTab = useCallback(async () => {
        reportError('Tabs are governed by Program and Semester settings.');
    }, []);

    const persistTabSettings = useCallback(async (tabId: string) => {
        const tab = tabsRef.current.find((candidate) => candidate.id === tabId);
        const pendingSettings = pendingSettingsRef.current.get(tabId);
        if (!tab || !pendingSettings) return;

        pendingSettingsRef.current.delete(tabId);
        const existingTimer = settingsTimersRef.current.get(tabId);
        if (existingTimer) {
            clearTimeout(existingTimer);
            settingsTimersRef.current.delete(tabId);
        }

        try {
            if (tab.source === 'governed') {
                const payload = { settings: stringifySettings(pendingSettings) };
                if (courseId) {
                    const result = await api.updateCourseRuntimeTabSettings(courseId, tab.type, payload);
                    setTabs((currentTabs) => currentTabs.map((currentTab) => (
                        currentTab.id === tabId
                            ? {
                                ...currentTab,
                                settings: parseSettingsObject(result.resolved_settings ?? result.settings),
                                title: result.title ?? currentTab.title,
                            }
                            : currentTab
                    )));
                } else if (semesterId) {
                    const result = await api.updateSemesterRuntimeTabSettings(semesterId, tab.type, payload);
                    setTabs((currentTabs) => currentTabs.map((currentTab) => (
                        currentTab.id === tabId
                            ? {
                                ...currentTab,
                                settings: parseSettingsObject(result.resolved_settings ?? result.settings),
                                title: result.title ?? currentTab.title,
                            }
                            : currentTab
                    )));
                }
            } else {
                await api.updateTab(tabId, { settings: stringifySettings(pendingSettings) });
            }

            await onRefresh?.();
        } catch (error) {
            console.error('Failed to persist tab settings', error);
            reportError('Failed to save tab settings. Please retry.');
            pendingSettingsRef.current.set(tabId, pendingSettings);
        }
    }, [courseId, onRefresh, semesterId]);

    const flushTabSettings = useCallback(async (tabId: string) => {
        await persistTabSettings(tabId);
    }, [persistTabSettings]);

    const updateTab = useCallback(async (tabId: string, data: { settings?: string | Record<string, unknown> }) => {
        if (!data.settings) return;
        const normalizedSettings = parseSettingsObject(data.settings);
        setTabs((currentTabs) => currentTabs.map((tab) => (
            tab.id === tabId ? { ...tab, settings: normalizedSettings } : tab
        )));
        tabsRef.current = tabsRef.current.map((tab) => (
            tab.id === tabId ? { ...tab, settings: normalizedSettings } : tab
        ));
        pendingSettingsRef.current.set(tabId, normalizedSettings);
        await persistTabSettings(tabId);
    }, [persistTabSettings]);

    const updateTabSettingsDebounced = useCallback((tabId: string, data: { settings?: string | Record<string, unknown> }) => {
        if (!data.settings) return;
        const normalizedSettings = parseSettingsObject(data.settings);

        setTabs((currentTabs) => currentTabs.map((tab) => (
            tab.id === tabId ? { ...tab, settings: normalizedSettings } : tab
        )));
        tabsRef.current = tabsRef.current.map((tab) => (
            tab.id === tabId ? { ...tab, settings: normalizedSettings } : tab
        ));
        pendingSettingsRef.current.set(tabId, normalizedSettings);

        const existingTimer = settingsTimersRef.current.get(tabId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
            void persistTabSettings(tabId);
        }, 300);
        settingsTimersRef.current.set(tabId, timer);
    }, [persistTabSettings]);

    const flushTabOrder = useCallback(async () => {
        if (!pendingOrderedIdsRef.current) return;

        const orderedIds = pendingOrderedIdsRef.current;
        pendingOrderedIdsRef.current = null;

        if (orderTimerRef.current) {
            clearTimeout(orderTimerRef.current);
            orderTimerRef.current = null;
        }

        const orderedTypes = orderedIds
            .map((tabId) => tabsRef.current.find((tab) => tab.id === tabId)?.type)
            .filter((type): type is string => typeof type === 'string' && type.length > 0);

        try {
            if (governed) {
                const reorderSemesterId = orderOwnerSemesterId ?? semesterId;
                if (!reorderSemesterId) {
                    return;
                }

                const result = await api.reorderSemesterRuntimeTabs(reorderSemesterId, orderedTypes);
                const normalizedTabs = result
                    .map((tab, index) => toTabItem(tab, scopeKey, index, true))
                    .filter((tab): tab is TabItem => tab !== null)
                    .sort((left, right) => left.order_index - right.order_index);
                if (normalizedTabs.length > 0) {
                    setTabs(normalizedTabs);
                    tabsRef.current = normalizedTabs;
                }
            } else {
                await Promise.all(orderedIds.map((tabId, index) => api.updateTab(tabId, { order_index: index })));
            }

            await onRefresh?.();
        } catch (error) {
            console.error('Failed to reorder governed tabs', error);
            reportError('Failed to save tab order. Please retry.');
        }
    }, [governed, onRefresh, orderOwnerSemesterId, scopeKey, semesterId]);

    const reorderTabs = useCallback((orderedIds: string[]) => {
        const nextOrderMap = new Map(orderedIds.map((id, index) => [id, index]));
        const nextTabs = tabsRef.current
            .map((tab) => {
                const nextOrder = nextOrderMap.get(tab.id);
                return nextOrder === undefined ? tab : { ...tab, order_index: nextOrder };
            })
            .sort((left, right) => left.order_index - right.order_index);

        setTabs(nextTabs);
        tabsRef.current = nextTabs;
        pendingOrderedIdsRef.current = orderedIds;

        if (orderTimerRef.current) {
            clearTimeout(orderTimerRef.current);
        }
        orderTimerRef.current = setTimeout(() => {
            void flushTabOrder();
        }, 300);
    }, [flushTabOrder]);

    useEffect(() => {
        return () => {
            settingsTimersRef.current.forEach((timer) => clearTimeout(timer));
            settingsTimersRef.current.clear();
            if (orderTimerRef.current) {
                clearTimeout(orderTimerRef.current);
            }
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
        reorderTabs,
    };
};
