import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TabItem as TabsBarItem } from '../components/Tabs';
import type { TabItem as DashboardTabItem } from './useDashboardTabs';
import {
    ensureTabPluginByTypeLoaded,
    getResolvedTabMetadataByType,
    hasTabPluginForType,
} from '../plugin-system';
import { TabRegistry, useTabRegistry } from '../services/tabRegistry';
import type { HomepageBuiltinTabConfig } from '../utils/homepageBuiltinTabs';
import { HOMEPAGE_DASHBOARD_TAB_ID, HOMEPAGE_SETTINGS_TAB_ID } from '../utils/homepageBuiltinTabs';

interface UseHomepageBuiltinTabsOptions {
    tabs: DashboardTabItem[];
    activeTabId: string;
    config: HomepageBuiltinTabConfig;
}

interface UseHomepageBuiltinTabsResult {
    registeredTabTypes: Set<string>;
    isActiveTabPluginLoading: boolean;
    tabBarItems: TabsBarItem[];
    visibleCustomTabs: DashboardTabItem[];
    isBuiltinTabId: (tabId: string) => boolean;
    filterReorderableTabIds: (orderedIds: string[]) => string[];
}

export const useHomepageBuiltinTabs = ({
    tabs,
    activeTabId,
    config,
}: UseHomepageBuiltinTabsOptions): UseHomepageBuiltinTabsResult => {
    const registeredTabs = useTabRegistry();
    const [isActiveTabPluginLoading, setIsActiveTabPluginLoading] = useState(false);

    // Registry updates tell us when lazy-loaded tab plugins are finally ready to render.
    const registeredTabTypes = useMemo(
        () => new Set(registeredTabs.map((tab) => tab.type)),
        [registeredTabs]
    );

    const isBuiltinTabId = useCallback(
        (tabId: string) =>
            tabId === HOMEPAGE_DASHBOARD_TAB_ID ||
            tabId === HOMEPAGE_SETTINGS_TAB_ID ||
            config.builtinTabIds.includes(tabId),
        [config.builtinTabIds]
    );

    const activeTabType = useMemo(() => {
        if (isBuiltinTabId(activeTabId)) {
            return activeTabId;
        }
        const currentTab = tabs.find((tab) => tab.id === activeTabId);
        return currentTab?.type;
    }, [activeTabId, isBuiltinTabId, tabs]);

    useEffect(() => {
        let isActive = true;

        if (!activeTabType || !hasTabPluginForType(activeTabType)) {
            setIsActiveTabPluginLoading(false);
            return () => {
                isActive = false;
            };
        }

        if (TabRegistry.getComponent(activeTabType)) {
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

    const visibleCustomTabs = useMemo(
        () => tabs.filter((tab) => !config.hiddenTabTypes.has(tab.type)),
        [config.hiddenTabTypes, tabs]
    );

    const pluginTabItems: TabsBarItem[] = visibleCustomTabs.map((tab) => {
        // Resolve basic display fields from metadata even when runtime component is still lazy.
        const metadata = getResolvedTabMetadataByType(tab.type);
        return {
            id: tab.id,
            label: metadata.name ?? tab.title ?? tab.type,
            icon: metadata.icon,
            removable: tab.is_removable !== false,
            draggable: tab.is_removable !== false,
        };
    });

    const buildFixedTabItem = (id: string, fallbackLabel: string): TabsBarItem => {
        const metadata = getResolvedTabMetadataByType(id);
        return {
            id,
            label: metadata.name ?? fallbackLabel,
            icon: metadata.icon,
            draggable: false,
            removable: false,
        };
    };

    const tabBarItems: TabsBarItem[] = [
        buildFixedTabItem(HOMEPAGE_DASHBOARD_TAB_ID, 'Dashboard'),
        ...config.builtinTabDescriptors.map(({ id, fallbackLabel }) =>
            buildFixedTabItem(id, fallbackLabel)
        ),
        ...pluginTabItems,
        buildFixedTabItem(HOMEPAGE_SETTINGS_TAB_ID, 'Settings'),
    ];

    const reorderableTabIds = useMemo(
        () => new Set(visibleCustomTabs.map((tab) => tab.id)),
        [visibleCustomTabs]
    );

    const filterReorderableTabIds = useCallback(
        (orderedIds: string[]) => orderedIds.filter((id) => reorderableTabIds.has(id)),
        [reorderableTabIds]
    );

    return {
        registeredTabTypes,
        isActiveTabPluginLoading,
        tabBarItems,
        visibleCustomTabs,
        isBuiltinTabId,
        filterReorderableTabIds,
    };
};
