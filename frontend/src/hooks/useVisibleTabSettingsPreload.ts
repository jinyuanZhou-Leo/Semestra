// input:  [visible tab items, tab runtime loader facade, and tab registry subscriptions]
// output: [`useVisibleTabSettingsPreload()` hook returning registered tab types for settings-page rendering]
// pos:    [shared hook that preloads visible tab runtimes so inactive tabs can still expose instance settings]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import { useEffect, useMemo } from 'react';

import { ensureTabPluginByTypeLoaded } from '../plugin-system';
import { useTabRegistry } from '../services/tabRegistry';

interface VisibleTabSettingsPreloadItem {
  type: string;
}

interface UseVisibleTabSettingsPreloadOptions {
  tabs: VisibleTabSettingsPreloadItem[];
  enabled: boolean;
  ignoredTypes?: string[];
}

export const useVisibleTabSettingsPreload = ({
  tabs,
  enabled,
  ignoredTypes = [],
}: UseVisibleTabSettingsPreloadOptions): Set<string> => {
  const registeredTabs = useTabRegistry();
  const registeredTabTypes = useMemo(
    () => new Set(registeredTabs.map((tab) => tab.type)),
    [registeredTabs]
  );
  const ignoredTypeSet = useMemo(() => new Set(ignoredTypes), [ignoredTypes]);
  const preloadTypes = useMemo(
    () => Array.from(new Set(
      tabs
        .map((tab) => tab.type)
        .filter((type) => !ignoredTypeSet.has(type))
    )),
    [ignoredTypeSet, tabs]
  );

  useEffect(() => {
    if (!enabled) return;

    preloadTypes.forEach((type) => {
      if (registeredTabTypes.has(type)) {
        return;
      }

      void ensureTabPluginByTypeLoaded(type).catch((error) => {
        console.error(`Failed to preload tab settings runtime for type: ${type}`, error);
      });
    });
  }, [enabled, preloadTypes, registeredTabTypes]);

  return registeredTabTypes;
};
