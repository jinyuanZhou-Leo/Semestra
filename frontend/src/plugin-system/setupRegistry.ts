// input:  [descriptor-backed plugin modules, setup schema definitions, and optional setup/review override components]
// output: [validated plugin setup registry facade for descriptor-backed JSON schema plus optional frontend-only setup/review overrides]
// pos:    [Plugin setup registry that consumes plugin.ts entries instead of generated manifests while preserving wizard/runtime setup helpers]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { PluginDefinition, PluginDescriptorSetupFieldDefinition, PluginDescriptorSetupSchema } from '@/plugin-sdk';
import type {
  PluginSetupDefinition,
  PluginSetupFieldDefinition,
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
  ui?: PluginSetupUiDefinition;
  validate?: PluginSetupDefinition['validate'];
}

const isDev = import.meta.env.DEV;
const validationConsole = globalThis.console;

const failValidation = (message: string) => {
  validationConsole.error(message);
  if (isDev) {
    validationConsole.trace('[plugin-system] Stack trace for validation failure above');
  }
};

const toSetupFieldDefinition = (
  field: PluginDescriptorSetupFieldDefinition,
): PluginSetupFieldDefinition => {
  const baseField = {
    settingsKey: field.settings_key,
    label: field.label,
    required: Boolean(field.required),
    description: field.description ?? '',
    placeholder: field.placeholder ?? '',
    defaultValue: field.default_value ?? null,
    options: [...(field.options ?? [])],
    summaryLabels: { ...field.summary_labels },
  };

  return { type: field.type, ...baseField } as PluginSetupFieldDefinition;
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
  if (!field.settings_key.trim()) {
    throw new Error(`${prefix}: settings_key must be non-empty.`);
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
    ui: pluginDefinition?.setup?.ui
      ? { ...pluginDefinition.setup.ui }
      : undefined,
    validate: validate as RegisteredPluginSetupDefinition['validate'],
  };
};

export type PluginModuleMap = Record<string, PluginModule>;

const pluginSetupDefinitions: RegisteredPluginSetupDefinition[] = [];
const pluginSetupDefinitionsById = new Map<string, RegisteredPluginSetupDefinition>();

/**
 * Initializes the setup registry from the shared plugin module map.
 * Called once by index.ts – avoids a duplicate `import.meta.glob` call.
 */
export const initSetupRegistry = (modules: PluginModuleMap): void => {
  pluginSetupDefinitions.length = 0;
  pluginSetupDefinitionsById.clear();

  const definitions = Object.values(modules)
    .flatMap((moduleValue) => {
      const pluginDefinition = moduleValue.default;
      const setup = pluginDefinition?.setup;
      const pluginId = pluginDefinition?.descriptor.id;
      if (!pluginDefinition || !setup || !pluginId) {
        return [];
      }
      try {
        const definition = createRegisteredPluginSetupDefinition(pluginId, setup.schema, pluginDefinition);
        return [Object.freeze(definition)];
      } catch (error) {
        failValidation(error instanceof Error ? error.message : String(error));
        return [];
      }
    })
    .sort((left, right) => left.pluginId.localeCompare(right.pluginId));

  for (const definition of definitions) {
    pluginSetupDefinitions.push(definition);
    pluginSetupDefinitionsById.set(definition.pluginId, definition);
  }
};

export const getAllPluginSetupDefinitions = (): RegisteredPluginSetupDefinition[] => {
  return pluginSetupDefinitions;
};

export const getPluginSetupDefinitionById = (pluginId: string): RegisteredPluginSetupDefinition | undefined => {
  return pluginSetupDefinitionsById.get(pluginId);
};

export const hasPluginSetupDefinition = (pluginId: string): boolean => {
  return pluginSetupDefinitionsById.has(pluginId);
};
