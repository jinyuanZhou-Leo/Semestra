// input:  [React runtime types, shared manifest contracts, plugin setup override contracts, and max-instance utility types]
// output: [stable plugin SDK runtime/settings/setup types layered on top of shared plugin manifest authoring contracts]
// pos:    [Public plugin authoring type surface used by plugin.ts entrypoints, typed manifest authoring, and runtime loading]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { FC, ReactNode } from 'react';
import type {
  PluginSettingsScope as RegistryPluginSettingsScope,
  PluginSettingsSectionDefinition as RegistryPluginSettingsSectionDefinition,
  PluginSettingsSectionProps as RegistryPluginSettingsSectionProps,
} from '@/services/pluginSettingsRegistry';

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

export interface PluginTabProps<S = any> {
  tabId: string;
  settings: S;
  semesterId?: string;
  courseId?: string;
  updateSettings: (nextSettings: S) => void | Promise<void>;
}

export interface PluginTabSettingsProps<S = any> {
  tabId: string;
  settings: S;
  semesterId?: string;
  courseId?: string;
  updateSettings: (nextSettings: S) => void | Promise<void>;
}

export interface PluginTabLifecycleContext {
  tabId: string;
  semesterId?: string;
  courseId?: string;
  settings: unknown;
}

export interface PluginTabDefinition {
  type: string;
  component: FC<PluginTabProps>;
  defaultSettings?: unknown;
  SettingsComponent?: FC<PluginTabSettingsProps>;
  onCreate?: (context: PluginTabLifecycleContext) => Promise<void> | void;
  onDelete?: (context: PluginTabLifecycleContext) => Promise<void> | void;
}

export interface PluginHeaderButtonContext {
  widgetId: string;
  settings: unknown;
  semesterId?: string;
  courseId?: string;
  updateSettings: (nextSettings: unknown) => void | Promise<void>;
}

export interface PluginHeaderActionButtonProps {
  title: string;
  icon: ReactNode;
  onClick: () => void | Promise<void>;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
}

export interface PluginHeaderConfirmActionButtonProps extends PluginHeaderActionButtonProps {
  dialogTitle: string;
  dialogDescription?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
}

export interface PluginHeaderButtonRenderHelpers {
  ActionButton: FC<PluginHeaderActionButtonProps>;
  ConfirmActionButton: FC<PluginHeaderConfirmActionButtonProps>;
}

export interface PluginHeaderButton {
  id: string;
  render: (context: PluginHeaderButtonContext, helpers: PluginHeaderButtonRenderHelpers) => ReactNode;
}

export interface PluginWidgetProps<S = any> {
  widgetId: string;
  settings: S;
  semesterId?: string;
  courseId?: string;
  updateSettings: (nextSettings: S) => void | Promise<void>;
  updateCourse?: (updates: unknown) => void;
}

export interface PluginWidgetLifecycleContext {
  widgetId: string;
  semesterId?: string;
  courseId?: string;
  settings: unknown;
}

export interface PluginWidgetSettingsProps<S = any> {
  widgetId?: string;
  semesterId?: string;
  courseId?: string;
  settings: S;
  onSettingsChange: (nextSettings: S) => void;
}

export interface PluginWidgetDefinition {
  type: string;
  component: FC<PluginWidgetProps>;
  defaultSettings?: unknown;
  headerButtons?: PluginHeaderButton[];
  SettingsComponent?: FC<PluginWidgetSettingsProps>;
  onCreate?: (context: PluginWidgetLifecycleContext) => Promise<void> | void;
  onDelete?: (context: PluginWidgetLifecycleContext) => Promise<void> | void;
}

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
