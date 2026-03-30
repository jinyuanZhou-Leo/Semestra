// input:  [frontend plugin metadata modules, optional settings/setup module discovery, and default context helpers]
// output: [`buildPluginMetadataManifest` helper plus manifest entry type for backend consumption with per-contribution context maps]
// pos:    [build-time serialization bridge that converts frontend plugin metadata, including unassigned-Course capability flags and per-tab/widget contexts, into a backend-readable JSON manifest while excluding host-reserved tabs from the public plugin manifest]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { PluginMetadataDefinition } from "./contracts";
import { DEFAULT_TAB_ALLOWED_CONTEXTS, DEFAULT_WIDGET_ALLOWED_CONTEXTS } from "./utils";
import { isHostReservedPluginId } from "@/utils/homepageBuiltinTabs";

type PluginMetadataModule = {
  default?: PluginMetadataDefinition;
};

export interface PluginMetadataManifestEntry {
  plugin_id: string;
  display_name: string;
  author: string;
  description: string;
  long_description: string;
  capabilities: {
    contexts: string[];
    available_tab_types: string[];
    available_widget_types: string[];
    tab_allowed_contexts: Record<string, string[]>;
    widget_allowed_contexts: Record<string, string[]>;
    has_settings: boolean;
    supports_unassigned_course: boolean;
  };
}

const metadataModules = import.meta.glob("../plugins/*/metadata.ts", { eager: true }) as Record<string, PluginMetadataModule>;
const settingsModules = {
  ...import.meta.glob("../plugins/*/settings.ts", { eager: true }),
  ...import.meta.glob("../plugins/*/settings.tsx", { eager: true }),
} as Record<string, object>;
const setupModules = {
  ...import.meta.glob("../plugins/*/setup.ts", { eager: true }),
  ...import.meta.glob("../plugins/*/setup.tsx", { eager: true }),
} as Record<string, object>;

const getDirectoryName = (path: string, suffixPattern: string): string | null => {
  const match = path.match(new RegExp(`^\\.\\.\\/plugins\\/([^/]+)\\/${suffixPattern}$`));
  return match?.[1] ?? null;
};

export const buildPluginMetadataManifest = (): PluginMetadataManifestEntry[] => {
  return Object.entries(metadataModules)
    .map(([path, moduleValue]) => {
      const definition = moduleValue.default;
      const directoryName = getDirectoryName(path, "metadata\\.ts");
      if (!definition || !directoryName) return null;
      if (isHostReservedPluginId(definition.pluginId)) return null;

      const tabCatalog = definition.tabCatalog ?? [];
      const widgetCatalog = definition.widgetCatalog ?? [];
      const contexts = new Set<string>();
      const tabAllowedContexts: Record<string, string[]> = {};
      const widgetAllowedContexts: Record<string, string[]> = {};
      tabCatalog.forEach((item) => (item.allowedContexts ?? DEFAULT_TAB_ALLOWED_CONTEXTS).forEach((context) => contexts.add(context)));
      widgetCatalog.forEach((item) => (item.allowedContexts ?? DEFAULT_WIDGET_ALLOWED_CONTEXTS).forEach((context) => contexts.add(context)));
      tabCatalog.forEach((item) => {
        tabAllowedContexts[item.type] = [...(item.allowedContexts ?? DEFAULT_TAB_ALLOWED_CONTEXTS)];
      });
      widgetCatalog.forEach((item) => {
        widgetAllowedContexts[item.type] = [...(item.allowedContexts ?? DEFAULT_WIDGET_ALLOWED_CONTEXTS)];
      });

      return {
        plugin_id: definition.pluginId,
        display_name: definition.displayName,
        author: definition.author,
        description: definition.description,
        long_description: definition.longDescription,
        capabilities: {
          contexts: [...contexts],
          available_tab_types: tabCatalog.map((item) => item.type),
          available_widget_types: widgetCatalog.map((item) => item.type),
          tab_allowed_contexts: tabAllowedContexts,
          widget_allowed_contexts: widgetAllowedContexts,
          has_settings:
            Boolean(settingsModules[`../plugins/${directoryName}/settings.ts`])
            || Boolean(settingsModules[`../plugins/${directoryName}/settings.tsx`])
            || Boolean(setupModules[`../plugins/${directoryName}/setup.ts`])
            || Boolean(setupModules[`../plugins/${directoryName}/setup.tsx`]),
          supports_unassigned_course: Boolean(definition.supportsUnassignedCourse),
        },
      };
    })
    .filter((entry): entry is PluginMetadataManifestEntry => entry !== null)
    .sort((left, right) => left.plugin_id.localeCompare(right.plugin_id));
};
