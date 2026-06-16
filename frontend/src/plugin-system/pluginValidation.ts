// input:  [descriptor-backed plugin definitions and constructed plugin entries]
// output: [settings-binding validator plus cross-plugin dedup/validation filter]
// pos:    [Internal plugin-system validation helpers extracted from the facade so index.ts stays focused on assembly and exports]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { PluginDefinition } from '@/plugin-sdk';
import type { PluginEntry } from './pluginRuntimeLoader';

/**
 * Ensures every settings section declared in plugin.ts also appears in the
 * descriptor's `settings.panels`. Throws on the first mismatch so the caller can
 * skip the offending plugin.
 */
export const validateSettingsSectionBindings = (definition: PluginDefinition) => {
  const declaredSectionIds = new Set((definition.descriptor.settings?.panels ?? []).map((section) => section.id));
  const settingsSections = definition.settingsSections ?? [];
  settingsSections.forEach((section) => {
    if (!declaredSectionIds.has(section.id)) {
      throw new Error(
        `[plugin-system] Settings section "${section.id}" in plugin "${definition.descriptor.id}" is missing from plugin.ts descriptor.settings.panels.`
      );
    }
  });
};

/**
 * Filters constructed plugin entries down to the accepted set, rejecting any
 * entry with a duplicate pluginId, a mismatched/duplicate tab type, or a
 * mismatched/duplicate widget type (within the plugin or across plugins).
 * Rejected entries are reported via `failValidation` and excluded.
 */
export const dedupePluginEntries = (
  rawEntries: PluginEntry[],
  failValidation: (message: string) => void,
): PluginEntry[] => {
  const acceptedPluginIds = new Set<string>();
  const acceptedTabTypes = new Map<string, string>();
  const acceptedWidgetTypes = new Map<string, string>();

  return rawEntries.filter((entry) => {
    const errors: string[] = [];

    if (acceptedPluginIds.has(entry.id)) {
      errors.push(`Duplicate pluginId "${entry.id}"`);
    }

    const ownTabTypes = new Set<string>();
    entry.tabCatalog.forEach((item) => {
      if (item.pluginId !== entry.id) {
        errors.push(`Tab catalog item "${item.type}" has mismatched pluginId "${item.pluginId}"`);
      }
      if (ownTabTypes.has(item.type)) {
        errors.push(`Duplicate tab type "${item.type}" inside plugin "${entry.id}"`);
        return;
      }
      ownTabTypes.add(item.type);

      const existingOwner = acceptedTabTypes.get(item.type);
      if (existingOwner) {
        errors.push(`Duplicate tab type "${item.type}" already owned by "${existingOwner}"`);
      }
    });

    const ownWidgetTypes = new Set<string>();
    entry.widgetCatalog.forEach((item) => {
      if (item.pluginId !== entry.id) {
        errors.push(`Widget catalog item "${item.type}" has mismatched pluginId "${item.pluginId}"`);
      }
      if (ownWidgetTypes.has(item.type)) {
        errors.push(`Duplicate widget type "${item.type}" inside plugin "${entry.id}"`);
        return;
      }
      ownWidgetTypes.add(item.type);

      const existingOwner = acceptedWidgetTypes.get(item.type);
      if (existingOwner) {
        errors.push(`Duplicate widget type "${item.type}" already owned by "${existingOwner}"`);
      }
    });

    if (errors.length > 0) {
      failValidation(`[plugin-system] Invalid plugin "${entry.id}": ${errors.join('; ')}`);
      return false;
    }

    acceptedPluginIds.add(entry.id);
    ownTabTypes.forEach((type) => acceptedTabTypes.set(type, entry.id));
    ownWidgetTypes.forEach((type) => acceptedWidgetTypes.set(type, entry.id));
    return true;
  });
};
