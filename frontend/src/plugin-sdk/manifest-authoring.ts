// input:  [plugin manifest/setup-schema authoring objects and shared manifest contracts]
// output: [validated manifest/setup authoring helpers for typed plugin metadata source files]
// pos:    [Production authoring surface that keeps plugin metadata in TypeScript while remaining serializable for backend generation]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type {
  PluginContext,
  PluginDescriptor,
  PluginDescriptorSetupFieldDefinition,
  PluginDescriptorSetupSchema,
  PluginDescriptorTabDefinition,
  PluginDescriptorWidgetDefinition,
  PluginSettingsFieldDefinition,
  PluginSettingsSectionBinding,
} from './manifest-types.ts';

const VALID_FIELD_TYPES = new Set(['text', 'textarea', 'number', 'boolean', 'select', 'date', 'json']);
const VALID_FIELD_SCOPES = new Set(['program-only', 'semester-override']);
const VALID_SETUP_PERSIST = new Set(['setupState', 'semesterOverride', 'both']);
const VALID_CONTEXTS = new Set<PluginContext>(['program', 'semester', 'course']);

const requireNonEmptyString = (value: string, label: string) => {
  if (!value.trim()) {
    throw new Error(`[plugin-sdk] ${label} must be non-empty.`);
  }
};

const validateContexts = (contexts: PluginContext[], label: string) => {
  if (contexts.length === 0) {
    throw new Error(`[plugin-sdk] ${label} must declare at least one context.`);
  }
  const seenContexts = new Set<PluginContext>();
  contexts.forEach((context) => {
    if (!VALID_CONTEXTS.has(context)) {
      throw new Error(`[plugin-sdk] ${label} uses unsupported context "${context}".`);
    }
    if (seenContexts.has(context)) {
      throw new Error(`[plugin-sdk] ${label} repeats context "${context}".`);
    }
    seenContexts.add(context);
  });
};

const cloneOptions = (options: { label: string; value: string }[] | undefined) => {
  return options?.map((option) => {
    requireNonEmptyString(option.label, 'Plugin option label');
    requireNonEmptyString(option.value, 'Plugin option value');
    return { ...option };
  });
};

const cloneSettingsField = (field: PluginSettingsFieldDefinition): PluginSettingsFieldDefinition => {
  requireNonEmptyString(field.path, 'Plugin settings field path');
  requireNonEmptyString(field.label, `Plugin settings field "${field.path}" label`);
  if (!VALID_FIELD_TYPES.has(field.type)) {
    throw new Error(`[plugin-sdk] Plugin settings field "${field.path}" uses unsupported type "${field.type}".`);
  }
  if (!VALID_FIELD_SCOPES.has(field.scope)) {
    throw new Error(`[plugin-sdk] Plugin settings field "${field.path}" uses unsupported scope "${field.scope}".`);
  }
  const options = cloneOptions(field.options);
  if (field.type === 'select' && (!options || options.length === 0)) {
    throw new Error(`[plugin-sdk] Plugin settings field "${field.path}" must declare options for select.`);
  }
  return {
    ...field,
    options,
  };
};

const cloneSettingsSection = (section: PluginSettingsSectionBinding): PluginSettingsSectionBinding => {
  requireNonEmptyString(section.id, 'Plugin settings section id');
  validateContexts(section.contexts, `Plugin settings section "${section.id}"`);
  return {
    ...section,
    contexts: [...section.contexts],
  };
};

const cloneTabDefinition = (tab: PluginDescriptorTabDefinition): PluginDescriptorTabDefinition => {
  requireNonEmptyString(tab.type, 'Plugin tab type');
  requireNonEmptyString(tab.title, `Plugin tab "${tab.type}" title`);
  validateContexts(tab.contexts, `Plugin tab "${tab.type}"`);
  return {
    ...tab,
    contexts: [...tab.contexts],
  };
};

const cloneWidgetDefinition = (widget: PluginDescriptorWidgetDefinition): PluginDescriptorWidgetDefinition => {
  requireNonEmptyString(widget.type, 'Plugin widget type');
  requireNonEmptyString(widget.title, `Plugin widget "${widget.type}" title`);
  validateContexts(widget.contexts, `Plugin widget "${widget.type}"`);
  if (widget.layout) {
    Object.entries(widget.layout).forEach(([key, value]) => {
      if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
        throw new Error(`[plugin-sdk] Plugin widget "${widget.type}" layout "${key}" must be a positive number.`);
      }
    });
  }
  return {
    ...widget,
    contexts: [...widget.contexts],
    layout: widget.layout ? { ...widget.layout } : undefined,
  };
};

const cloneSetupField = (field: PluginDescriptorSetupFieldDefinition): PluginDescriptorSetupFieldDefinition => {
  requireNonEmptyString(field.path, 'Plugin setup field path');
  requireNonEmptyString(field.label, `Plugin setup field "${field.path}" label`);
  if (!VALID_FIELD_TYPES.has(field.type)) {
    throw new Error(`[plugin-sdk] Plugin setup field "${field.path}" uses unsupported type "${field.type}".`);
  }
  if (!VALID_SETUP_PERSIST.has(field.persist)) {
    throw new Error(`[plugin-sdk] Plugin setup field "${field.path}" uses unsupported persist "${field.persist}".`);
  }
  const options = cloneOptions(field.options);
  if (field.type === 'select' && (!options || options.length === 0)) {
    throw new Error(`[plugin-sdk] Plugin setup field "${field.path}" must declare options for select.`);
  }
  return {
    ...field,
    options,
    summary_labels: { ...(field.summary_labels ?? {}) },
  };
};

export const definePluginManifest = (descriptor: PluginDescriptor): PluginDescriptor => {
  requireNonEmptyString(descriptor.id, 'Plugin id');
  requireNonEmptyString(descriptor.display_name, `Plugin "${descriptor.id}" display_name`);
  requireNonEmptyString(descriptor.author, `Plugin "${descriptor.id}" author`);
  requireNonEmptyString(descriptor.description, `Plugin "${descriptor.id}" description`);
  requireNonEmptyString(descriptor.long_description, `Plugin "${descriptor.id}" long_description`);

  return {
    ...descriptor,
    tabs: (descriptor.tabs ?? []).map(cloneTabDefinition),
    widgets: (descriptor.widgets ?? []).map(cloneWidgetDefinition),
    settings: {
      defaults: { ...(descriptor.settings?.defaults ?? {}) },
      fields: (descriptor.settings?.fields ?? []).map(cloneSettingsField),
      sections: (descriptor.settings?.sections ?? []).map(cloneSettingsSection),
    },
  };
};

export const definePluginSetupSchema = (
  schema: PluginDescriptorSetupSchema,
): PluginDescriptorSetupSchema => {
  const seenSectionIds = new Set<string>();
  return {
    sections: schema.sections.map((section) => {
      requireNonEmptyString(section.id, 'Plugin setup section id');
      requireNonEmptyString(section.title, `Plugin setup section "${section.id}" title`);
      if (seenSectionIds.has(section.id)) {
        throw new Error(`[plugin-sdk] Plugin setup schema repeats section "${section.id}".`);
      }
      seenSectionIds.add(section.id);
      if (section.fields.length === 0) {
        throw new Error(`[plugin-sdk] Plugin setup section "${section.id}" must declare at least one field.`);
      }
      return {
        ...section,
        fields: section.fields.map(cloneSetupField),
      };
    }),
    validation_rules: [...(schema.validation_rules ?? [])],
  };
};
