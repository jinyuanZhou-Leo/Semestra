// input:  [React runtime types, shared manifest contracts, plugin setup override contracts, and max-instance utility types]
// output: [stable plugin SDK runtime/settings/setup types layered on top of shared plugin manifest authoring contracts]
// pos:    [Public plugin authoring type surface used by plugin.ts entrypoints, typed manifest authoring, and runtime loading]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type {
  PluginSettingsScope as RegistryPluginSettingsScope,
  PluginSettingsSectionDefinition as RegistryPluginSettingsSectionDefinition,
  PluginSettingsSectionProps as RegistryPluginSettingsSectionProps,
} from '@/services/pluginSettingsRegistry';
import type {
  HeaderActionButtonProps,
  HeaderButton,
  HeaderButtonContext,
  HeaderButtonRenderHelpers,
  HeaderConfirmActionButtonProps,
  WidgetDefinition,
  WidgetLifecycleContext,
  WidgetProps,
  WidgetSettingsProps,
} from '@/services/widgetRegistry';
import type {
  TabDefinition,
  TabLifecycleContext,
  TabProps,
} from '@/services/tabRegistry';

import type {
  PluginSetupUiDefinition as PluginSetupOverrideDefinition,
  PluginSetupReviewRenderProps,
  PluginSetupValidationIssue,
  PluginSetupWizardRenderProps,
} from '@/plugin-system/setup';
import type {
  PluginContext,
  PluginDescriptor,
  PluginDescriptorSetupSchema,
} from './manifest-types.ts';
export type * from './manifest-types.ts';

// Tab/widget/header authoring contracts are owned by the in-memory registries
// (`services/tabRegistry`, `services/widgetRegistry`). The SDK re-exports them
// under the `Plugin*` names so plugin authors keep a single import surface
// without maintaining a parallel, drift-prone copy of these shapes.
export type PluginTabProps = TabProps;
export type PluginTabLifecycleContext = TabLifecycleContext;
export type PluginTabDefinition = TabDefinition;

export type PluginHeaderButtonContext = HeaderButtonContext;
export type PluginHeaderActionButtonProps = HeaderActionButtonProps;
export type PluginHeaderConfirmActionButtonProps = HeaderConfirmActionButtonProps;
export type PluginHeaderButtonRenderHelpers = HeaderButtonRenderHelpers;
export type PluginHeaderButton = HeaderButton;

export type PluginWidgetProps<S = unknown> = WidgetProps<S>;
export type PluginWidgetLifecycleContext = WidgetLifecycleContext;
export type PluginWidgetSettingsProps<S = unknown> = WidgetSettingsProps<S>;
export type PluginWidgetDefinition<S = unknown> = WidgetDefinition<S>;

export type PluginSettingsScope = RegistryPluginSettingsScope;
export type PluginSettingsSectionProps = RegistryPluginSettingsSectionProps;
export type PluginSettingsSectionDefinition = RegistryPluginSettingsSectionDefinition & {
  allowedContexts?: PluginContext[];
};

export interface PluginSettingsDefinition {
  pluginSettings?: PluginSettingsSectionDefinition[];
}

export interface PluginRuntimeDefinition {
  tabDefinitions?: PluginTabDefinition[];
  widgetDefinitions?: PluginWidgetDefinition[];
}

export interface PluginSetupUiDefinition {
  schema: PluginDescriptorSetupSchema;
  ui?: PluginSetupOverrideDefinition;
  validate?: (values: Record<string, unknown>) => PluginSetupValidationIssue[] | Promise<PluginSetupValidationIssue[]>;
}

export interface PluginDefinition {
  descriptor: PluginDescriptor;
  loadRuntime: () => Promise<PluginRuntimeDefinition>;
  /** @deprecated Use `settingsDefinition` instead. */
  settingsSections?: PluginSettingsSectionDefinition[];
  /** Pass the return value of `definePluginSettings()` directly. */
  settingsDefinition?: PluginSettingsDefinition;
  setup?: PluginSetupUiDefinition;
}

export type {
  PluginSetupReviewRenderProps,
  PluginSetupValidationIssue,
  PluginSetupWizardRenderProps,
};
