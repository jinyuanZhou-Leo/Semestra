// input:  [descriptor-backed plugin modules, setup schema definitions, and setup UI/validation contracts]
// output: [validated plugin setup registry facade for descriptor-backed JSON schema plus optional frontend-only custom setup UI]
// pos:    [Plugin setup registry that consumes plugin.ts entries instead of generated manifests while preserving wizard/runtime setup helpers]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { PluginDefinition, PluginDescriptorSetupFieldDefinition, PluginDescriptorSetupSchema } from '@/plugin-sdk';
import type {
  PluginSetupDefinition,
  PluginSetupFieldDefinition,
  PluginSetupPersist,
  PluginSetupSectionDefinition,
  PluginSetupUiDefinition,
} from './setup';

type PluginModule = {
  default?: PluginDefinition;
};

export interface RegisteredPluginSetupDefinition {
  pluginId: string;
  fields: Record<string, PluginSetupFieldDefinition>;
  fieldOrder: string[];
  sections: PluginSetupSectionDefinition[];
  ui: PluginSetupUiDefinition;
  validate?: PluginSetupDefinition['validate'];
}

const pluginModules = import.meta.glob('../plugins/*/plugin.ts', { eager: true }) as Record<string, PluginModule>;
const isDev = import.meta.env.DEV;

const failValidation = (message: string) => {
  if (isDev) {
    throw new Error(message);
  }
  console.error(message);
};

const DEFAULT_SETUP_UI: PluginSetupUiDefinition = { kind: 'dsl' };

const toSetupFieldDefinition = (
  field: PluginDescriptorSetupFieldDefinition,
): PluginSetupFieldDefinition => {
  const baseField = {
    label: field.label,
    persist: field.persist as PluginSetupPersist,
    required: Boolean(field.required),
    description: field.description ?? '',
    placeholder: field.placeholder ?? '',
    defaultValue: field.default_value ?? null,
    options: [...(field.options ?? [])],
    summaryLabels: { ...(field.summary_labels ?? {}) },
  };
  switch (field.type) {
    case 'json':
      return { type: 'json', ...baseField } as unknown as PluginSetupFieldDefinition;
    case 'select':
      return { type: 'select', ...baseField } as unknown as PluginSetupFieldDefinition;
    case 'boolean':
      return { type: 'boolean', ...baseField } as unknown as PluginSetupFieldDefinition;
    case 'number':
      return { type: 'number', ...baseField } as unknown as PluginSetupFieldDefinition;
    case 'textarea':
      return { type: 'textarea', ...baseField } as unknown as PluginSetupFieldDefinition;
    case 'date':
      return { type: 'date', ...baseField } as unknown as PluginSetupFieldDefinition;
    default:
      return { type: 'text', ...baseField } as unknown as PluginSetupFieldDefinition;
  }
};

const validateSetupFieldDefinition = (
  pluginId: string,
  field: PluginDescriptorSetupFieldDefinition,
) => {
  const prefix = `[plugin-system] Invalid setup field "${field.path}" in plugin "${pluginId}"`;
  if (!field.path.trim()) {
    throw new Error(`${prefix}: path must be non-empty.`);
  }
  if (!field.label.trim()) {
    throw new Error(`${prefix}: label must be non-empty.`);
  }
  if (!['setupState', 'semesterOverride', 'both'].includes(field.persist)) {
    throw new Error(`${prefix}: persist must be setupState, semesterOverride, or both.`);
  }
  if (field.type === 'select' && (!field.options || field.options.length === 0)) {
    throw new Error(`${prefix}: select fields must declare at least one option.`);
  }
}

export const createRegisteredPluginSetupDefinition = (
  pluginId: string,
  setupSchema: PluginDescriptorSetupSchema,
  pluginDefinition?: PluginDefinition,
): RegisteredPluginSetupDefinition => {
  const fieldOrder: string[] = [];
  const fields: Record<string, PluginSetupFieldDefinition> = {};
  const sectionIds = new Set<string>();

  const sections = setupSchema.sections.map((sectionDefinition) => {
    if (!sectionDefinition.id.trim()) {
      throw new Error(`[plugin-system] Invalid setup section in plugin "${pluginId}": id must be non-empty.`);
    }
    if (sectionIds.has(sectionDefinition.id)) {
      throw new Error(`[plugin-system] Duplicate setup section id "${sectionDefinition.id}" in plugin "${pluginId}".`);
    }
    sectionIds.add(sectionDefinition.id);
    if (!sectionDefinition.title.trim()) {
      throw new Error(`[plugin-system] Invalid setup section "${sectionDefinition.id}" in plugin "${pluginId}": title must be non-empty.`);
    }
    if (sectionDefinition.fields.length === 0) {
      throw new Error(`[plugin-system] Invalid setup section "${sectionDefinition.id}" in plugin "${pluginId}": fields are required.`);
    }

    const sectionFieldKeys = sectionDefinition.fields.map((fieldDefinition) => {
      validateSetupFieldDefinition(pluginId, fieldDefinition);
      if (fields[fieldDefinition.path]) {
        return fieldDefinition.path;
      }
      fieldOrder.push(fieldDefinition.path);
      fields[fieldDefinition.path] = toSetupFieldDefinition(fieldDefinition);
      return fieldDefinition.path;
    });

    return {
      id: sectionDefinition.id,
      title: sectionDefinition.title,
      description: sectionDefinition.description ?? '',
      fieldKeys: sectionFieldKeys,
    };
  });

  const validate = pluginDefinition?.setup?.validate
    ? async ({ values }: { values: Record<string, unknown> }) => pluginDefinition.setup?.validate?.(values) ?? []
    : undefined;

  return {
    pluginId,
    fields,
    fieldOrder,
    sections,
    ui: pluginDefinition?.setup?.ui ?? DEFAULT_SETUP_UI,
    validate: validate as RegisteredPluginSetupDefinition['validate'],
  };
};

const pluginSetupDefinitions = Object.values(pluginModules)
  .flatMap((moduleValue) => {
    const pluginDefinition = moduleValue.default;
    const setup = pluginDefinition?.setup;
    const pluginId = pluginDefinition?.descriptor.id;
    if (!pluginDefinition || !setup || !pluginId) {
      return [];
    }
    try {
      return [createRegisteredPluginSetupDefinition(pluginId, setup.schema, pluginDefinition)];
    } catch (error) {
      failValidation(error instanceof Error ? error.message : String(error));
      return [];
    }
  })
  .sort((left, right) => left.pluginId.localeCompare(right.pluginId));

const pluginSetupDefinitionsById = new Map(pluginSetupDefinitions.map((definition) => [definition.pluginId, definition]));

const cloneDefinition = (definition: RegisteredPluginSetupDefinition): RegisteredPluginSetupDefinition => ({
  pluginId: definition.pluginId,
  fields: { ...definition.fields },
  fieldOrder: [...definition.fieldOrder],
  sections: definition.sections.map((sectionDefinition) => ({
    ...sectionDefinition,
    fieldKeys: [...sectionDefinition.fieldKeys],
  })),
  ui: definition.ui,
  validate: definition.validate,
});

export const getAllPluginSetupDefinitions = (): RegisteredPluginSetupDefinition[] => {
  return pluginSetupDefinitions.map(cloneDefinition);
};

export const getPluginSetupDefinitionById = (pluginId: string): RegisteredPluginSetupDefinition | undefined => {
  const definition = pluginSetupDefinitionsById.get(pluginId);
  return definition ? cloneDefinition(definition) : undefined;
};

export const hasPluginSetupDefinition = (pluginId: string): boolean => {
  return pluginSetupDefinitionsById.has(pluginId);
};
