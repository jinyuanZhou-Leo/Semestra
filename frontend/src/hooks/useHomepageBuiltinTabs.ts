import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TabItem as TabsBarItem } from '../components/Tabs';
import type { TabItem as DashboardTabItem } from './useDashboardTabs';
import {
    ensureTabPluginByTypeLoaded,
    getResolvedTabMetadataByType,
    hasTabPluginForType,
} from '../plugin-system';
import { TabRegistry, useTabRegistry } from '../services/tabRegistry';
import type { HomepageBuiltinTabConfig } from '../utils/homepageBuiltinTabs';

interface UseHomepageBuiltinTabsOptions {
    tabs: DashboardTabItem[];
    activeTabId: string;
    config: HomepageBuiltinTabConfig;
    isTabsInitialized: boolean;
    ensureBuiltinTabInstance: (type: string) => void | Promise<void>;
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
    ensureBuiltinTabInstance,
}: UseHomepageBuiltinTabsOptions): UseHomepageBuiltinTabsResult => {
    const registeredTabs = useTabRegistry();
    const [isActiveTabPluginLoading, setIsActiveTabPluginLoading] = useState(false);
    const pendingBuiltinTabTypesRef = useRef<Set<string>>(new Set());

    // Registry updates tell us when lazy-loaded tab plugins are finally ready to render.
    const registeredTabTypes = useMemo(
        () => new Set(registeredTabs.map((tab) => tab.type)),
        [registeredTabs]
    );

    useEffect(() => {
        if (!isTabsInitialized) return;

        const nextMissingType = config.builtinTabTypes.find((type) => {
            if (pendingBuiltinTabTypesRef.current.has(type)) return false;
            return !tabs.some((tab) => tab.type === type);
        });
        if (!nextMissingType) return;

        pendingBuiltinTabTypesRef.current.add(nextMissingType);
        void Promise.resolve(ensureBuiltinTabInstance(nextMissingType))
            .catch((error) => {
                console.error(`Failed to ensure builtin tab instance for type: ${nextMissingType}`, error);
            })
            .finally(() => {
                pendingBuiltinTabTypesRef.current.delete(nextMissingType);
            });
    }, [config.builtinTabTypes, ensureBuiltinTabInstance, isTabsInitialized, tabs]);

    const areBuiltinTabsReady = useMemo(
        () => config.builtinTabTypes.every((type) => tabs.some((tab) => tab.type === type)),
        [config.builtinTabTypes, tabs]
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

    const visibleTabs = useMemo(() => {
        const tabsByType = new Map<string, DashboardTabItem[]>();
        const trailingBuiltinTabTypes = config.trailingBuiltinTabTypes ?? [];
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

        config.builtinTabTypes.forEach((type) => {
            if (trailingBuiltinTypeSet.has(type)) return;
            const matchingTabs = tabsByType.get(type);
            if (!matchingTabs?.length) return;
            matchingTabs.forEach((tab) => {
                ordered.push(tab);
                consumedTabIds.add(tab.id);
            });
        });

        tabs.forEach((tab) => {
            if (consumedTabIds.has(tab.id)) return;
            if (trailingBuiltinTypeSet.has(tab.type)) return;
            ordered.push(tab);
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
    }, [config.builtinTabTypes, config.trailingBuiltinTabTypes, tabs]);

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
