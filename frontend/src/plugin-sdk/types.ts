// input:  [React runtime types, plugin setup UI contracts, and shared max-instance utility types]
// output: [stable plugin SDK descriptor/runtime/settings/setup types that do not expose service-registry internals]
// pos:    [Public plugin authoring type surface used by plugin.ts entrypoints and descriptor-backed runtime loading]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { FC, ReactNode } from 'react';

import type { MaxInstances } from '@/plugin-system/utils';
import type {
  PluginSetupCustomUiDefinition,
  PluginSetupReviewRenderProps,
  PluginSetupValidationIssue,
  PluginSetupWizardRenderProps,
} from '@/plugin-system/setup';

export type PluginContext = 'program' | 'semester' | 'course';
export type PluginWorkspaceContext = Extract<PluginContext, 'semester' | 'course'>;

export interface PluginDescriptorFieldOption {
  label: string;
  value: string;
}

export interface PluginSettingsFieldDefinition {
  path: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'date' | 'json';
  scope: 'program-only' | 'semester-override';
  default?: unknown;
  description?: string;
  options?: PluginDescriptorFieldOption[];
}

export interface PluginDescriptorSetupFieldDefinition {
  path: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'date' | 'json';
  persist: 'setupState' | 'semesterOverride' | 'both';
  required?: boolean;
  default_value?: unknown;
  description?: string;
  placeholder?: string;
  options?: PluginDescriptorFieldOption[];
  summary_labels?: Record<string, string>;
}

export interface PluginDescriptorSetupSectionDefinition {
  id: string;
  title: string;
  description?: string;
  fields: PluginDescriptorSetupFieldDefinition[];
}

export interface PluginDescriptorValidationRule {
  type: 'json-array-min-length' | 'json-array-unique-keys';
  field: string;
  min_length?: number;
  keys?: string[];
  message: string;
}

export interface PluginDescriptorSetupSchema {
  sections: PluginDescriptorSetupSectionDefinition[];
  validation_rules?: PluginDescriptorValidationRule[];
}

export interface PluginDescriptorTabDefinition {
  type: string;
  title: string;
  description?: string;
  icon?: string;
  contexts: PluginWorkspaceContext[];
}

export interface PluginDescriptorWidgetLayout {
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface PluginDescriptorWidgetDefinition {
  type: string;
  title: string;
  description?: string;
  icon?: string;
  contexts: PluginWorkspaceContext[];
  layout?: PluginDescriptorWidgetLayout;
  max_instances?: MaxInstances;
}

export interface PluginSettingsSectionBinding {
  id: string;
  contexts: PluginContext[];
}

export interface PluginSettingsDescriptor {
  defaults?: Record<string, unknown>;
  fields?: PluginSettingsFieldDefinition[];
  sections?: PluginSettingsSectionBinding[];
}

export interface PluginDescriptor {
  id: string;
  display_name: string;
  author: string;
  description: string;
  long_description: string;
  icon?: string;
  tabs?: PluginDescriptorTabDefinition[];
  widgets?: PluginDescriptorWidgetDefinition[];
  settings?: PluginSettingsDescriptor;
}

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
  component: FC<any>;
  defaultSettings?: any;
  SettingsComponent?: FC<any>;
  onCreate?: (context: PluginTabLifecycleContext) => Promise<void> | void;
  onDelete?: (context: PluginTabLifecycleContext) => Promise<void> | void;
}

export interface PluginHeaderButtonContext {
  widgetId: string;
  settings: any;
  semesterId?: string;
  courseId?: string;
  updateSettings: (nextSettings: any) => void | Promise<void>;
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
  component: FC<any>;
  defaultSettings?: any;
  headerButtons?: PluginHeaderButton[];
  SettingsComponent?: FC<any>;
  onCreate?: (context: PluginWidgetLifecycleContext) => Promise<void> | void;
  onDelete?: (context: PluginWidgetLifecycleContext) => Promise<void> | void;
}

export type PluginSettingsScope =
  | { kind: 'program'; programId: string }
  | { kind: 'semester'; semesterId: string; programId?: string }
  | { kind: 'course'; courseId: string; semesterId?: string; programId?: string };

export interface PluginSettingsSectionProps {
  pluginId: string;
  scope: PluginSettingsScope;
  onRefresh: () => void;
}

export interface PluginSettingsSectionDefinition {
  id: string;
  component: FC<PluginSettingsSectionProps>;
  allowedContexts?: PluginContext[];
}

export interface PluginSettingsDefinition {
  pluginSettings?: PluginSettingsSectionDefinition[];
}

export interface PluginRuntimeDefinition {
  tabDefinitions?: PluginTabDefinition[];
  widgetDefinitions?: PluginWidgetDefinition[];
}

export interface PluginSetupUiDefinition {
  schema: PluginDescriptorSetupSchema;
  ui?: PluginSetupCustomUiDefinition;
  validate?: (values: Record<string, unknown>) => PluginSetupValidationIssue[] | Promise<PluginSetupValidationIssue[]>;
}

export interface PluginDefinition {
  descriptor: PluginDescriptor;
  loadRuntime: () => Promise<PluginRuntimeDefinition>;
  settingsSections?: PluginSettingsSectionDefinition[];
  setup?: PluginSetupUiDefinition;
}

export type {
  PluginSetupReviewRenderProps,
  PluginSetupValidationIssue,
  PluginSetupWizardRenderProps,
};
