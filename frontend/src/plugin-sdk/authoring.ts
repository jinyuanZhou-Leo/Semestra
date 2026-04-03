// input:  [plugin SDK types, typed manifest authoring helpers, and node-safe setup authoring helpers without runtime host re-exports]
// output: [node-safe plugin authoring helpers for plugin definitions, manifests, setup schemas, setup bindings, and settings sections]
// pos:    [Pure authoring entry used by plugin.ts files and manifest generation without depending on runtime-only alias exports]
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
} from './types.ts';
import {
  definePluginManifest,
  definePluginSetupSchema,
} from './manifest-authoring.ts';
export {
  createPluginSetupBinding,
  definePluginSetup,
  PluginSetupBooleanField,
  PluginSetupDateField,
  PluginSetupJsonField,
  PluginSetupNumberField,
  PluginSetupSection,
  PluginSetupSelectField,
  PluginSetupTextField,
  PluginSetupTextareaField,
  type InferPluginSetupValues,
  type PluginSetupReviewRenderProps,
  type PluginSetupUiDefinition as PluginSetupOverrideDefinition,
  type PluginSetupValidationIssue,
  type PluginSetupWizardRenderProps,
} from '../plugin-system/setup.ts';

export { definePluginManifest, definePluginSetupSchema };
export type * from './types.ts';

export const definePlugin = (definition: PluginDefinition): PluginDefinition => {
  // Resolve settings sections: prefer settingsDefinition (new path), fall back to settingsSections (legacy).
  const rawSections: PluginSettingsSectionDefinition[] =
    definition.settingsDefinition?.pluginSettings
    ?? definition.settingsSections
    ?? [];

  return Object.freeze({
    descriptor: {
      ...definition.descriptor,
      tabs: [...(definition.descriptor.tabs ?? [])],
      widgets: [...(definition.descriptor.widgets ?? [])],
      settings: {
        panels: [...(definition.descriptor.settings?.panels ?? [])],
      },
    },
    loadRuntime: definition.loadRuntime,
    settingsSections: rawSections.map((section) => defineSettingsSection(section)),
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
};

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
