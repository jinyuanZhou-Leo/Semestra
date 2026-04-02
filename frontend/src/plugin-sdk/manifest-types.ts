// input:  [React component typing plus plugin settings/setup primitive literals]
// output: [serializable and authoring-safe plugin manifest, setup-schema, and icon type contracts]
// pos:    [Shared manifest contract layer used by plugin authoring, frontend runtime descriptors, and manifest generation]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { ComponentType } from 'react';

export type PluginContext = 'program' | 'semester' | 'course';
export type PluginWorkspaceContext = Extract<PluginContext, 'semester' | 'course'>;
export type MaxInstances = number | 'unlimited';

export type PluginIconComponent = ComponentType<{ className?: string }>;
export type PluginIconDefinition = string | PluginIconComponent;

export interface PluginDescriptorFieldOption {
  label: string;
  value: string;
}

export interface PluginDescriptorSetupFieldDefinition {
  path: string;
  settings_key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'date' | 'json';
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
  icon?: PluginIconDefinition;
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
  icon?: PluginIconDefinition;
  contexts: PluginWorkspaceContext[];
  layout?: PluginDescriptorWidgetLayout;
  max_instances?: MaxInstances;
}

export interface PluginSettingsPanelBinding {
  id: string;
  contexts: PluginContext[];
}

export interface PluginSettingsDescriptor {
  panels?: PluginSettingsPanelBinding[];
}

export interface PluginDescriptor {
  id: string;
  display_name: string;
  author: string;
  description: string;
  long_description: string;
  icon?: PluginIconDefinition;
  tabs?: PluginDescriptorTabDefinition[];
  widgets?: PluginDescriptorWidgetDefinition[];
  settings?: PluginSettingsDescriptor;
}

export interface SerializedPluginDescriptorTabDefinition extends Omit<PluginDescriptorTabDefinition, 'icon'> {
  icon?: string;
}

export interface SerializedPluginDescriptorWidgetDefinition extends Omit<PluginDescriptorWidgetDefinition, 'icon'> {
  icon?: string;
}

export interface SerializedPluginDescriptor extends Omit<PluginDescriptor, 'icon' | 'tabs' | 'widgets'> {
  icon?: string;
  tabs?: SerializedPluginDescriptorTabDefinition[];
  widgets?: SerializedPluginDescriptorWidgetDefinition[];
}
