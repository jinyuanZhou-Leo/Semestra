// input:  [runtime tab settings/order APIs, initial resolved tab payloads from semester/course detail, normalized runtime availability adapters, and retry/status helpers]
// output: [`TabItem` type and `useDashboardTabs()` state/actions for Program->Semester managed runtime tabs]
// pos:    [Runtime tab orchestration hook that treats semester/course tabs as host-managed API state instead of locally created plugin instances while preserving optimistic tab identity across managed reorder acknowledgements]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getResolvedTabMetadataByType } from '../plugin-system';
import type { SettingLayer, TabSettingsMeta } from '../plugin-system/tabSettingsMeta';
import type { ResolvedRuntimeTab } from '../plugin-system/runtimeAvailability';
import api, { type RuntimeAvailability, type RuntimeResolvedTab, type Tab } from '../services/api';
import { reportError } from '../services/appStatus';
import { jsonDeepEqual } from '../plugin-system/utils';

export interface TabItem {
    id: string;
    type: string;
    title: string;
    settings?: Record<string, unknown>;
    scope_settings?: Record<string, unknown>;
    inherited_settings?: Record<string, unknown>;
    settings_meta?: TabSettingsMeta;
    order_index: number;
    is_removable?: boolean;
    is_draggable?: boolean;
    source: 'governed' | 'legacy' | 'synthetic';
    availability?: RuntimeAvailability;
}

interface UseDashboardTabsProps {
    courseId?: string;
    semesterId?: string;
    orderOwnerSemesterId?: string;
    initialTabs?: Array<Tab | RuntimeResolvedTab | ResolvedRuntimeTab>;
    managed?: boolean;
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
    tab: Tab | RuntimeResolvedTab | ResolvedRuntimeTab,
    scopeKey: string,
    index: number,
    managed: boolean
): TabItem | null => {
    const type = 'tab_type' in tab ? tab.tab_type : tab.type;
    if (!type) return null;

    const id = ('id' in tab && typeof tab.id === 'string' && tab.id.length > 0)
        ? tab.id
        : `${scopeKey}:${type}`;
    const title = ('title' in tab && typeof tab.title === 'string' && tab.title.length > 0)
        ? tab.title
        : type;
    const resolvedTitle = title === type
        ? (getResolvedTabMetadataByType(type).name || title)
        : title;
    const settings = 'resolved_settings' in tab
        ? parseSettingsObject(tab.resolved_settings ?? tab.settings)
        : parseSettingsObject(tab.settings);
    const scopeSettings = 'scope_settings' in tab
        ? parseSettingsObject(tab.scope_settings ?? tab.settings)
        : parseSettingsObject(tab.settings);
    const inheritedSettings = 'inherited_settings' in tab
        ? parseSettingsObject(tab.inherited_settings)
        : {};
    const settingsMeta = 'settings_meta' in tab && tab.settings_meta
        ? tab.settings_meta
        : {
            scopeSettings,
            inheritedSettings,
            settingSources: 'settings_meta' in tab && tab.settings_meta ? tab.settings_meta.settingSources : {},
        };

    return {
        id,
        type,
        title: resolvedTitle,
        settings,
        scope_settings: scopeSettings,
        inherited_settings: inheritedSettings,
        settings_meta: settingsMeta,
        order_index: typeof tab.order_index === 'number' ? tab.order_index : index,
        is_removable: tab.is_removable,
        is_draggable: tab.is_draggable,
        source: managed ? 'governed' : 'legacy',
        availability: 'availability' in tab && tab.availability ? tab.availability as RuntimeAvailability : undefined,
    };
};

const stringifySettings = (settings: Record<string, unknown>) => JSON.stringify(settings ?? {});

const deriveScopeSettings = (
    desiredResolvedSettings: Record<string, unknown>,
    inheritedSettings: Record<string, unknown>,
): Record<string, unknown> => {
    const nextScopeSettings: Record<string, unknown> = {};
    const candidateKeys = new Set([
        ...Object.keys(desiredResolvedSettings),
        ...Object.keys(inheritedSettings),
    ]);

    candidateKeys.forEach((key) => {
        if (!(key in desiredResolvedSettings)) {
            return;
        }
        if (key in inheritedSettings && jsonDeepEqual(desiredResolvedSettings[key], inheritedSettings[key])) {
            return;
        }
        nextScopeSettings[key] = desiredResolvedSettings[key];
    });

    return nextScopeSettings;
};

const getCurrentScopeLayer = (courseId?: string): SettingLayer => (
    courseId ? 'course' : 'semester'
);

const getFallbackLayer = (
    previousMeta: TabSettingsMeta | undefined,
    key: string,
): SettingLayer | null => {
    const previousSource = previousMeta?.settingSources[key];
    if (!previousSource) {
        return 'default';
    }
    if (previousSource.is_overridden_in_scope) {
        return previousSource.fallback_layer ?? 'default';
    }
    return previousSource.effective_layer;
};

const buildOptimisticSettingsMeta = (
    previousMeta: TabSettingsMeta | undefined,
    nextScopeSettings: Record<string, unknown>,
    inheritedSettings: Record<string, unknown>,
    changedKeys: Iterable<string>,
    currentLayer: SettingLayer,
): TabSettingsMeta => {
    const nextSettingSources = {
        ...(previousMeta?.settingSources ?? {}),
    };

    Array.from(changedKeys).forEach((key) => {
        if (key in nextScopeSettings) {
            nextSettingSources[key] = {
                effective_layer: currentLayer,
                is_overridden_in_scope: true,
                fallback_layer: getFallbackLayer(previousMeta, key),
            };
            return;
        }

        const fallbackLayer = getFallbackLayer(previousMeta, key);
        nextSettingSources[key] = {
            effective_layer: fallbackLayer ?? 'default',
            is_overridden_in_scope: false,
            fallback_layer: fallbackLayer,
        };
    });

    return {
        scopeSettings: nextScopeSettings,
        inheritedSettings,
        settingSources: nextSettingSources,
    };
};

const mergeManagedTabsFromServer = (currentTabs: TabItem[], serverTabs: TabItem[]): TabItem[] => {
    if (serverTabs.length === 0) {
        return currentTabs;
    }

    const serverTabsByType = new Map(serverTabs.map((tab) => [tab.type, tab]));
    const mergedTabs = currentTabs.map((currentTab) => {
        const serverTab = serverTabsByType.get(currentTab.type);
        if (!serverTab) {
            return currentTab;
        }

        // Preserve the client-facing tab id so active homepage selection does not reset mid-reorder.
        return {
            ...currentTab,
            ...serverTab,
            id: currentTab.id,
        };
    });

    const existingTypes = new Set(mergedTabs.map((tab) => tab.type));
    serverTabs.forEach((serverTab) => {
        if (!existingTypes.has(serverTab.type)) {
            mergedTabs.push(serverTab);
        }
    });

    return mergedTabs.sort((left, right) => left.order_index - right.order_index);
};

export const useDashboardTabs = ({
    courseId,
    semesterId,
    orderOwnerSemesterId,
    initialTabs,
    managed = true,
    onRefresh,
}: UseDashboardTabsProps) => {
    const [tabs, setTabs] = useState<TabItem[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const tabsRef = useRef<TabItem[]>([]);
    const settingsTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const pendingSettingsRef = useRef<Map<string, Record<string, unknown>>>(new Map());
    const orderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingOrderedIdsRef = useRef<string[] | null>(null);
    const currentScopeLayer = getCurrentScopeLayer(courseId);

    const scopeKey = courseId ? `course:${courseId}` : `semester:${semesterId ?? 'unknown'}`;
    const normalizedInitialTabs = useMemo(() => (
        (initialTabs ?? [])
            .map((tab, index) => toTabItem(tab, scopeKey, index, managed))
            .filter((tab): tab is TabItem => tab !== null)
            .sort((left, right) => left.order_index - right.order_index)
    ), [initialTabs, managed, scopeKey]);

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
                                settings: result.settings,
                                scope_settings: result.scope_settings,
                                inherited_settings: result.inherited_settings,
                                settings_meta: result.settings_meta,
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
                                settings: result.settings,
                                scope_settings: result.scope_settings,
                                inherited_settings: result.inherited_settings,
                                settings_meta: result.settings_meta,
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
        const currentTab = tabsRef.current.find((tab) => tab.id === tabId);
        const previousScopeSettings = currentTab?.scope_settings ?? {};
        const changedKeys = new Set([
            ...Object.keys(previousScopeSettings),
            ...Object.keys(normalizedSettings),
        ]);
        const normalizedScopeSettings = deriveScopeSettings(
            normalizedSettings,
            currentTab?.inherited_settings ?? {},
        );
        const optimisticSettingsMeta = buildOptimisticSettingsMeta(
            currentTab?.settings_meta,
            normalizedScopeSettings,
            currentTab?.inherited_settings ?? {},
            changedKeys,
            currentScopeLayer,
        );
        setTabs((currentTabs) => currentTabs.map((tab) => (
            tab.id === tabId
                ? {
                    ...tab,
                    settings: normalizedSettings,
                    scope_settings: normalizedScopeSettings,
                    settings_meta: optimisticSettingsMeta,
                }
                : tab
        )));
        tabsRef.current = tabsRef.current.map((tab) => (
            tab.id === tabId
                ? {
                    ...tab,
                    settings: normalizedSettings,
                    scope_settings: normalizedScopeSettings,
                    settings_meta: optimisticSettingsMeta,
                }
                : tab
        ));
        pendingSettingsRef.current.set(tabId, normalizedScopeSettings);
        await persistTabSettings(tabId);
    }, [currentScopeLayer, persistTabSettings]);

    const updateTabSettingsDebounced = useCallback((tabId: string, data: { settings?: string | Record<string, unknown> }) => {
        if (!data.settings) return;
        const normalizedSettings = parseSettingsObject(data.settings);
        const currentTab = tabsRef.current.find((tab) => tab.id === tabId);
        const previousScopeSettings = currentTab?.scope_settings ?? {};
        const changedKeys = new Set([
            ...Object.keys(previousScopeSettings),
            ...Object.keys(normalizedSettings),
        ]);
        const normalizedScopeSettings = deriveScopeSettings(
            normalizedSettings,
            currentTab?.inherited_settings ?? {},
        );
        const optimisticSettingsMeta = buildOptimisticSettingsMeta(
            currentTab?.settings_meta,
            normalizedScopeSettings,
            currentTab?.inherited_settings ?? {},
            changedKeys,
            currentScopeLayer,
        );

        setTabs((currentTabs) => currentTabs.map((tab) => (
            tab.id === tabId
                ? {
                    ...tab,
                    settings: normalizedSettings,
                    scope_settings: normalizedScopeSettings,
                    settings_meta: optimisticSettingsMeta,
                }
                : tab
        )));
        tabsRef.current = tabsRef.current.map((tab) => (
            tab.id === tabId
                ? {
                    ...tab,
                    settings: normalizedSettings,
                    scope_settings: normalizedScopeSettings,
                    settings_meta: optimisticSettingsMeta,
                }
                : tab
        ));
        pendingSettingsRef.current.set(tabId, normalizedScopeSettings);

        const existingTimer = settingsTimersRef.current.get(tabId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
            void persistTabSettings(tabId);
        }, 300);
        settingsTimersRef.current.set(tabId, timer);
    }, [currentScopeLayer, persistTabSettings]);

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
            if (managed) {
                const reorderSemesterId = orderOwnerSemesterId ?? semesterId;
                const result = reorderSemesterId
                    ? await api.reorderSemesterRuntimeTabs(reorderSemesterId, orderedTypes)
                    : courseId
                        ? await api.reorderCourseRuntimeTabs(courseId, orderedTypes)
                        : [];
                const normalizedTabs = result
                    .map((tab, index) => toTabItem(tab, scopeKey, index, true))
                    .filter((tab): tab is TabItem => tab !== null)
                    .sort((left, right) => left.order_index - right.order_index);
                if (normalizedTabs.length > 0) {
                    setTabs((currentTabs) => {
                        const mergedTabs = mergeManagedTabsFromServer(currentTabs, normalizedTabs);
                        tabsRef.current = mergedTabs;
                        return mergedTabs;
                    });
                }
            } else {
                await Promise.all(orderedIds.map((tabId, index) => api.updateTab(tabId, { order_index: index })));
            }

            await onRefresh?.();
        } catch (error) {
            console.error('Failed to reorder managed tabs', error);
            reportError('Failed to save tab order. Please retry.');
        }
    }, [courseId, managed, onRefresh, orderOwnerSemesterId, scopeKey, semesterId]);

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
        const settingsTimers = settingsTimersRef.current;
        return () => {
            settingsTimers.forEach((timer) => clearTimeout(timer));
            settingsTimers.clear();
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
