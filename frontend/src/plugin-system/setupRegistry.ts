// input:  [plugin metadata modules, optional plugin setup modules, setup DSL contracts, and Vite eager module discovery]
// output: [validated plugin setup registry facade plus backend-manifest serialization helpers]
// pos:    [Pure plugin setup registry that bridges frontend-authored setup DSL definitions into host/runtime facades and generated backend setup manifests]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { PluginMetadataDefinition } from "./contracts";
import { definePluginSetup, type PluginSetupDefinition, type PluginSetupFieldDefinition, type PluginSetupPersist, type PluginSetupSectionDefinition } from "./setup";

type PluginMetadataModule = {
    default?: PluginMetadataDefinition;
};

type PluginSetupModule = {
    default?: PluginSetupDefinition;
};

export interface RegisteredPluginSetupDefinition {
    pluginId: string;
    fields: Record<string, PluginSetupFieldDefinition>;
    fieldOrder: string[];
    sections: PluginSetupSectionDefinition[];
}

export interface PluginSetupManifestField {
    path: string;
    label: string;
    type: PluginSetupFieldDefinition["type"];
    persist: PluginSetupPersist;
    required: boolean;
    description: string;
    placeholder: string;
    default_value: unknown;
    options: Array<{ label: string; value: string }>;
    summary_labels: Record<string, string>;
}

export interface PluginSetupManifestSection {
    id: string;
    title: string;
    description: string;
    fields: PluginSetupManifestField[];
}

export interface PluginSetupManifestEntry {
    plugin_id: string;
    fields: PluginSetupManifestField[];
    sections: PluginSetupManifestSection[];
}

const metadataModules = import.meta.glob("../plugins/*/metadata.ts", { eager: true }) as Record<string, PluginMetadataModule>;
const setupModules = import.meta.glob("../plugins/*/setup.ts", { eager: true }) as Record<string, PluginSetupModule>;

const isDev = import.meta.env.DEV;

const getDirectoryName = (path: string, suffixPattern: string): string | null => {
    const match = path.match(new RegExp(`^\\.\\.\\/plugins\\/([^/]+)\\/${suffixPattern}$`));
    return match?.[1] ?? null;
};

const failValidation = (message: string) => {
    if (isDev) {
        throw new Error(message);
    }
    console.error(message);
};

const validateSetupFieldDefinition = (
    pluginId: string,
    fieldKey: string,
    field: PluginSetupFieldDefinition,
) => {
    const prefix = `[plugin-system] Invalid setup field "${fieldKey}" in plugin "${pluginId}"`;

    if (fieldKey.trim().length === 0) {
        throw new Error(`${prefix}: field key must be non-empty.`);
    }
    if (field.label.trim().length === 0) {
        throw new Error(`${prefix}: label must be non-empty.`);
    }
    if (!["setupState", "semesterOverride", "both"].includes(field.persist)) {
        throw new Error(`${prefix}: persist must be setupState, semesterOverride, or both.`);
    }
    if (field.type === "select") {
        if (!Array.isArray(field.options) || field.options.length === 0) {
            throw new Error(`${prefix}: select fields must declare at least one option.`);
        }
        const optionValues = new Set<string>();
        field.options.forEach((option) => {
            if (option.label.trim().length === 0 || option.value.trim().length === 0) {
                throw new Error(`${prefix}: select options must have non-empty label and value.`);
            }
            if (optionValues.has(option.value)) {
                throw new Error(`${prefix}: duplicate select option value "${option.value}".`);
            }
            optionValues.add(option.value);
        });
    }
};

export const createRegisteredPluginSetupDefinition = (
    pluginId: string,
    definition: PluginSetupDefinition,
): RegisteredPluginSetupDefinition => {
    const normalized = definePluginSetup(definition);
    const fieldEntries = Object.entries(normalized.fields);
    const fieldOrder = fieldEntries.map(([fieldKey]) => fieldKey);
    const fieldMap = new Map<string, PluginSetupFieldDefinition>();

    fieldEntries.forEach(([fieldKey, field]) => {
        validateSetupFieldDefinition(pluginId, fieldKey, field);
        fieldMap.set(fieldKey, field);
    });

    const sectionIds = new Set<string>();
    normalized.sections.forEach((sectionDefinition, sectionIndex) => {
        if (sectionDefinition.id.trim().length === 0) {
            throw new Error(`[plugin-system] Invalid setup section at index ${sectionIndex} in plugin "${pluginId}": id must be non-empty.`);
        }
        if (sectionIds.has(sectionDefinition.id)) {
            throw new Error(`[plugin-system] Duplicate setup section id "${sectionDefinition.id}" in plugin "${pluginId}".`);
        }
        sectionIds.add(sectionDefinition.id);
        if (sectionDefinition.title.trim().length === 0) {
            throw new Error(`[plugin-system] Invalid setup section "${sectionDefinition.id}" in plugin "${pluginId}": title must be non-empty.`);
        }
        if (sectionDefinition.fieldKeys.length === 0) {
            throw new Error(`[plugin-system] Invalid setup section "${sectionDefinition.id}" in plugin "${pluginId}": at least one field key is required.`);
        }

        const seenFieldKeys = new Set<string>();
        sectionDefinition.fieldKeys.forEach((fieldKey) => {
            if (!fieldMap.has(fieldKey)) {
                throw new Error(`[plugin-system] Invalid setup section "${sectionDefinition.id}" in plugin "${pluginId}": unknown field key "${fieldKey}".`);
            }
            if (seenFieldKeys.has(fieldKey)) {
                throw new Error(`[plugin-system] Invalid setup section "${sectionDefinition.id}" in plugin "${pluginId}": duplicate field key "${fieldKey}".`);
            }
            seenFieldKeys.add(fieldKey);
        });
    });

    return {
        pluginId,
        fields: Object.fromEntries(fieldEntries),
        fieldOrder,
        sections: normalized.sections.map((sectionDefinition) => ({
            ...sectionDefinition,
            fieldKeys: [...sectionDefinition.fieldKeys],
        })),
    };
};

const setupEntries = Object.entries(setupModules).flatMap(([path, moduleValue]) => {
    const directoryName = getDirectoryName(path, "setup\\.ts");
    if (!directoryName) {
        failValidation(`[plugin-system] Invalid setup module path: ${path}`);
        return [];
    }

    const metadataModule = metadataModules[`../plugins/${directoryName}/metadata.ts`];
    const pluginId = metadataModule?.default?.pluginId;
    if (!pluginId) {
        failValidation(`[plugin-system] Setup module "${path}" is missing a matching metadata.ts plugin definition.`);
        return [];
    }

    if (!moduleValue?.default) {
        failValidation(`[plugin-system] Setup module "${path}" must default-export definePluginSetup(...).`);
        return [];
    }

    try {
        return [createRegisteredPluginSetupDefinition(pluginId, moduleValue.default)];
    } catch (error) {
        failValidation(error instanceof Error ? error.message : String(error));
        return [];
    }
});

const pluginSetupDefinitions = [...setupEntries].sort((left, right) => left.pluginId.localeCompare(right.pluginId));
const pluginSetupDefinitionsById = new Map(pluginSetupDefinitions.map((definition) => [definition.pluginId, definition]));

const buildManifestField = (path: string, field: PluginSetupFieldDefinition): PluginSetupManifestField => ({
    path,
    label: field.label,
    type: field.type,
    persist: field.persist,
    required: Boolean(field.required),
    description: field.description ?? "",
    placeholder: field.placeholder ?? "",
    default_value: field.defaultValue ?? null,
    options: field.type === "select" ? field.options.map((option) => ({ ...option })) : [],
    summary_labels: { ...(field.summaryLabels ?? {}) },
});

export const buildPluginSetupManifest = (): PluginSetupManifestEntry[] => {
    return pluginSetupDefinitions.map((definition) => {
        const fields = definition.fieldOrder.map((fieldKey) => buildManifestField(fieldKey, definition.fields[fieldKey]));
        const manifestFieldsByPath = new Map(fields.map((field) => [field.path, field]));

        return {
            plugin_id: definition.pluginId,
            fields,
            sections: definition.sections.map((sectionDefinition) => ({
                id: sectionDefinition.id,
                title: sectionDefinition.title,
                description: sectionDefinition.description ?? "",
                fields: sectionDefinition.fieldKeys.map((fieldKey) => {
                    const field = manifestFieldsByPath.get(fieldKey);
                    if (!field) {
                        throw new Error(`[plugin-system] Setup manifest serialization failed for plugin "${definition.pluginId}": missing field "${fieldKey}".`);
                    }
                    return {
                        ...field,
                        options: field.options.map((option) => ({ ...option })),
                        summary_labels: { ...field.summary_labels },
                    };
                }),
            })),
        };
    });
};

export const getAllPluginSetupDefinitions = (): RegisteredPluginSetupDefinition[] => {
    return pluginSetupDefinitions.map((definition) => ({
        pluginId: definition.pluginId,
        fields: { ...definition.fields },
        fieldOrder: [...definition.fieldOrder],
        sections: definition.sections.map((sectionDefinition) => ({
            ...sectionDefinition,
            fieldKeys: [...sectionDefinition.fieldKeys],
        })),
    }));
};

export const getPluginSetupDefinitionById = (pluginId: string): RegisteredPluginSetupDefinition | undefined => {
    const definition = pluginSetupDefinitionsById.get(pluginId);
    if (!definition) {
        return undefined;
    }
    return {
        pluginId: definition.pluginId,
        fields: { ...definition.fields },
        fieldOrder: [...definition.fieldOrder],
        sections: definition.sections.map((sectionDefinition) => ({
            ...sectionDefinition,
            fieldKeys: [...sectionDefinition.fieldKeys],
        })),
    };
};

export const hasPluginSetupDefinition = (pluginId: string): boolean => {
    return pluginSetupDefinitionsById.has(pluginId);
};
