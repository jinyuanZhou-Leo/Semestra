// input:  [raw dashboard tabs, builtin-tab config, plugin metadata resolvers, and tab registry updates]
// output: [`useHomepageBuiltinTabs()` derived tab-bar state and reorder/filter helpers]
// pos:    [Homepage-specific tab orchestration for governed runtime tabs, lazy readiness, and fixed shell-tab placement without overriding user reorder]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TabItem as TabsBarItem } from '../components/Tabs';
import type { TabItem as DashboardTabItem } from './useDashboardTabs';
import {
    ensureTabPluginByTypeLoaded,
    getTabComponentByType,
    getResolvedTabMetadataByType,
    hasTabPluginForType,
} from '../plugin-system';
import { useTabRegistry } from '../services/tabRegistry';
import type { HomepageBuiltinTabConfig } from '../utils/homepageBuiltinTabs';

interface UseHomepageBuiltinTabsOptions {
    tabs: DashboardTabItem[];
    activeTabId: string;
    config: HomepageBuiltinTabConfig;
    isTabsInitialized: boolean;
}

interface UseHomepageBuiltinTabsResult {
    registeredTabTypes: Set<string>;
    isActiveTabPluginLoading: boolean;
    tabBarItems: TabsBarItem[];
    visibleTabs: DashboardTabItem[];
    areBuiltinTabsReady: boolean;
    filterReorderableTabIds: (orderedIds: string[]) => string[];
}

export const useHomepageBuiltinTabs = ({
    tabs,
    activeTabId,
    config,
    isTabsInitialized,
}: UseHomepageBuiltinTabsOptions): UseHomepageBuiltinTabsResult => {
    const registeredTabs = useTabRegistry();
    const [isActiveTabPluginLoading, setIsActiveTabPluginLoading] = useState(false);

    // Registry updates tell us when lazy-loaded tab plugins are finally ready to render.
    const registeredTabTypes = useMemo(
        () => new Set(registeredTabs.map((tab) => tab.type)),
        [registeredTabs]
    );

    const areBuiltinTabsReady = useMemo(
        () => isTabsInitialized && (tabs.length > 0 || config.builtinTabTypes.length === 0),
        [config.builtinTabTypes.length, isTabsInitialized, tabs.length]
    );

    const activeTabType = useMemo(() => {
        const currentTab = tabs.find((tab) => tab.id === activeTabId);
        return currentTab?.type;
    }, [activeTabId, tabs]);

    useEffect(() => {
        let isActive = true;

        if (!activeTabType || !hasTabPluginForType(activeTabType)) {
            setIsActiveTabPluginLoading(false);
            return () => {
                isActive = false;
            };
        }

        if (getTabComponentByType(activeTabType)) {
            setIsActiveTabPluginLoading(false);
            return () => {
                isActive = false;
            };
        }

        setIsActiveTabPluginLoading(true);
        void ensureTabPluginByTypeLoaded(activeTabType)
            .catch((error) => {
                console.error(`Failed to load active tab plugin for type: ${activeTabType}`, error);
            })
            .finally(() => {
                if (isActive) {
                    setIsActiveTabPluginLoading(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [activeTabType]);

    const visibleTabs = useMemo(() => {
        const tabsByType = new Map<string, DashboardTabItem[]>();
        const leadingBuiltinTabTypes = config.leadingBuiltinTabTypes ?? [];
        const trailingBuiltinTabTypes = config.trailingBuiltinTabTypes ?? [];
        const leadingBuiltinTypeSet = new Set(leadingBuiltinTabTypes);
        const trailingBuiltinTypeSet = new Set(trailingBuiltinTabTypes);

        tabs.forEach((tab) => {
            const group = tabsByType.get(tab.type);
            if (group) {
                group.push(tab);
                return;
            }
            tabsByType.set(tab.type, [tab]);
        });

        const ordered: DashboardTabItem[] = [];
        const consumedTabIds = new Set<string>();

        leadingBuiltinTabTypes.forEach((type) => {
            const matchingTabs = tabsByType.get(type);
            if (!matchingTabs?.length) return;
            matchingTabs.forEach((tab) => {
                ordered.push(tab);
                consumedTabIds.add(tab.id);
            });
        });

        tabs.forEach((tab) => {
            if (consumedTabIds.has(tab.id)) return;
            if (leadingBuiltinTypeSet.has(tab.type) || trailingBuiltinTypeSet.has(tab.type)) return;
            ordered.push(tab);
            consumedTabIds.add(tab.id);
        });

        trailingBuiltinTabTypes.forEach((type) => {
            const matchingTabs = tabsByType.get(type);
            if (!matchingTabs?.length) return;
            matchingTabs.forEach((tab) => {
                if (consumedTabIds.has(tab.id)) return;
                ordered.push(tab);
                consumedTabIds.add(tab.id);
            });
        });

        return ordered;
    }, [config.leadingBuiltinTabTypes, config.trailingBuiltinTabTypes, tabs]);

    const tabBarItems: TabsBarItem[] = visibleTabs.map((tab) => {
        // Resolve basic display fields from metadata even when runtime component is still lazy.
        const metadata = getResolvedTabMetadataByType(tab.type);
        return {
            id: tab.id,
            label: metadata.name ?? tab.title ?? tab.type,
            icon: metadata.icon,
            removable: tab.is_removable !== false,
            draggable: tab.is_draggable !== false,
        };
    });

    const visibleTabIds = useMemo(
        () => new Set(visibleTabs.map((tab) => tab.id)),
        [visibleTabs]
    );

    const nonReorderableTabIds = useMemo(() => {
        const trailingBuiltinTypeSet = new Set(config.trailingBuiltinTabTypes ?? []);
        return new Set(
            visibleTabs
                .filter((tab) => trailingBuiltinTypeSet.has(tab.type))
                .map((tab) => tab.id)
        );
    }, [config.trailingBuiltinTabTypes, visibleTabs]);

    const filterReorderableTabIds = useCallback(
        (orderedIds: string[]) => orderedIds.filter((id) => visibleTabIds.has(id) && !nonReorderableTabIds.has(id)),
        [nonReorderableTabIds, visibleTabIds]
    );

    return {
        registeredTabTypes,
        isActiveTabPluginLoading,
        tabBarItems,
        visibleTabs,
        areBuiltinTabsReady,
        filterReorderableTabIds,
    };
};
