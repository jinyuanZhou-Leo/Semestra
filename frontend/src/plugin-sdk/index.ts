// input:  [descriptor-backed plugin SDK types plus host/runtime helper modules]
// output: [single public plugin authoring entrypoint with define helpers, host APIs, runtime instance APIs, and setup UI types]
// pos:    [Stable frontend plugin SDK that hides internal registries behind a descriptor-first authoring surface]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type {
  PluginDefinition,
  PluginHeaderButton,
  PluginRuntimeDefinition,
  PluginSettingsDefinition,
  PluginSettingsSectionDefinition,
  PluginSetupUiDefinition,
  PluginTabDefinition,
  PluginWidgetDefinition,
} from './types';

export type * from './types';
export type { MaxInstances } from '@/plugin-system/utils';

export const definePlugin = (definition: PluginDefinition): PluginDefinition => ({
  descriptor: {
    ...definition.descriptor,
    tabs: [...(definition.descriptor.tabs ?? [])],
    widgets: [...(definition.descriptor.widgets ?? [])],
    settings: {
      defaults: { ...(definition.descriptor.settings?.defaults ?? {}) },
      fields: [...(definition.descriptor.settings?.fields ?? [])],
      sections: [...(definition.descriptor.settings?.sections ?? [])],
    },
  },
  loadRuntime: definition.loadRuntime,
  settingsSections: [...(definition.settingsSections ?? [])],
  setup: definition.setup
    ? {
      schema: {
        sections: definition.setup.schema.sections.map((section) => ({
          ...section,
          fields: section.fields.map((field) => ({
            ...field,
            options: [...(field.options ?? [])],
            summary_labels: { ...(field.summary_labels ?? {}) },
          })),
        })),
        validation_rules: [...(definition.setup.schema.validation_rules ?? [])],
      },
      ui: definition.setup.ui,
      validate: definition.setup.validate,
    }
    : undefined,
});

export const definePluginRuntime = (definition: PluginRuntimeDefinition): PluginRuntimeDefinition => ({
  tabDefinitions: [...(definition.tabDefinitions ?? [])],
  widgetDefinitions: [...(definition.widgetDefinitions ?? [])],
});

export const defineTab = (definition: PluginTabDefinition): PluginTabDefinition => ({
  ...definition,
});

export const defineWidget = (definition: PluginWidgetDefinition): PluginWidgetDefinition => ({
  ...definition,
  headerButtons: [...(definition.headerButtons ?? [])] as PluginHeaderButton[],
});

export const defineSettingsSection = (
  definition: PluginSettingsSectionDefinition,
): PluginSettingsSectionDefinition => ({
  ...definition,
  allowedContexts: [...(definition.allowedContexts ?? [])],
});

export const definePluginSettings = (
  definition: PluginSettingsDefinition,
): PluginSettingsDefinition => ({
  pluginSettings: [...(definition.pluginSettings ?? [])],
});

export const defineSetup = (definition: PluginSetupUiDefinition): PluginSetupUiDefinition => ({
  schema: {
    sections: definition.schema.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => ({
        ...field,
        options: [...(field.options ?? [])],
        summary_labels: { ...(field.summary_labels ?? {}) },
      })),
    })),
    validation_rules: [...(definition.schema.validation_rules ?? [])],
  },
  ui: definition.ui,
  validate: definition.validate,
});

export { PluginHostProvider, usePluginHost } from '@/plugin-system/PluginHostContext';
export type {
  PluginHostJumpOptions,
  PluginHostJumpResult,
  PluginHostJumpTarget,
  PluginHostTabLike,
} from '@/plugin-system/PluginHostContext';
export {
  PluginRuntimeInstanceProvider,
  buildPluginUiStateStorageKey,
  usePluginRuntimeInstanceContext as usePluginRuntimeInstance,
} from '@/plugin-system/PluginRuntimeInstanceContext';
export type {
  PluginRuntimeInstanceValue,
  PluginRuntimeSlotKind,
  PluginRuntimeWorkspaceKind,
} from '@/plugin-system/PluginRuntimeInstanceContext';
export {
  PluginContentFadeIn,
  PluginTabSkeleton,
  PluginWidgetSkeleton,
} from '@/plugin-system/PluginLoadSkeleton';
export { resetPluginUiStateCacheForTests, usePluginUiState } from '@/plugin-system/PluginUiState';
