// input:  [plugin settings section registry, shared settings section renderer, and scope-aware section prop contracts]
// output: [curated settings-section exports for renderer, registry types, and registry access helpers]
// pos:    [Thin settings-section public surface that exposes registration contracts and read helpers without leaking plugin loader internals]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import {
  PluginSettingsRegistry,
  type PluginSettingsContext,
  type RegisteredPluginSettingsSectionDefinition,
  usePluginSettingsRegistry as usePluginSettingsRegistryStore,
} from '../services/pluginSettingsRegistry';

export { PluginSettingsSectionRenderer } from './PluginSettingsSectionRenderer';
export type {
  PluginSettingsContext,
  PluginSettingsScope,
  PluginSettingsSectionDefinition,
  PluginSettingsSectionProps,
  RegisteredPluginSettingsSectionDefinition,
} from '../services/pluginSettingsRegistry';

export const usePluginSettingsRegistry = (
  context?: PluginSettingsContext
): RegisteredPluginSettingsSectionDefinition[] => {
  return usePluginSettingsRegistryStore(context);
};

export const getPluginSettingsSections = (
  context?: PluginSettingsContext
): RegisteredPluginSettingsSectionDefinition[] => {
  return PluginSettingsRegistry.getAllPluginSettingsSections(context);
};
