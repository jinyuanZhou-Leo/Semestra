// input:  [runtime tab order APIs, initial resolved tab payloads from semester/course detail, normalized runtime availability adapters, and retry/status helpers]
// output: [`TabItem` type and `useDashboardTabs()` state/actions for Program->Semester managed runtime tabs]
// pos:    [Runtime tab orchestration hook that treats semester/course tabs as host-managed API state instead of locally created plugin instances while preserving optimistic tab identity across managed reorder acknowledgements]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getResolvedTabMetadataByType } from '../plugin-system';
import type { ResolvedRuntimeTab } from '../plugin-system/runtimeAvailability';
import api, { type RuntimeAvailability, type RuntimeResolvedTab, type Tab } from '../services/api';
import { reportError } from '../services/appStatus';

export interface TabItem {
    id: string;
    type: string;
    title: string;
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

    return {
        id,
        type,
        title: resolvedTitle,
        order_index: typeof tab.order_index === 'number' ? tab.order_index : index,
        is_removable: tab.is_removable,
        is_draggable: tab.is_draggable,
        source: managed ? 'governed' : 'legacy',
        availability: 'availability' in tab && tab.availability ? tab.availability as RuntimeAvailability : undefined,
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
    const orderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingOrderedIdsRef = useRef<string[] | null>(null);

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
        return () => {
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
        reorderTabs,
    };
};
