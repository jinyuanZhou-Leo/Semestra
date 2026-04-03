// input:  [plugin-authored setup component trees plus optional setup/review React override renderers]
// output: [setup contract types, declarative setup field components, validation helpers, backend-schema serialization helpers, setup-authoring adapters, and `definePluginSetup` registration helper]
// pos:    [Plugin setup authoring layer that lets plugins declare setup with host-provided field components while still emitting backend-serializable field/section manifests and optional setup/review overrides with draft-semester context]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { Children, Fragment, isValidElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import type { PluginDescriptorSetupSchema } from "@/plugin-sdk/manifest-types";
export type PluginSetupFieldType = "text" | "textarea" | "number" | "boolean" | "select" | "date" | "json";

type PluginSetupSummaryLabels = Record<string, string>;

export interface PluginSetupValidationIssue {
    code?: string;
    fieldPath?: string;
    message: string;
}

export interface PluginSetupReviewSummaryItem {
    path: string;
    label: string;
    value: string;
}

export interface PluginSetupReviewSummarySection {
    id: string;
    title: string;
    description?: string;
    items: PluginSetupReviewSummaryItem[];
}

export interface PluginSetupValidationContext<
    TFields extends Record<string, PluginSetupFieldDefinition> = Record<string, PluginSetupFieldDefinition>,
> {
    fields: TFields;
    values: Record<string, unknown>;
}

export interface PluginSetupRenderDefinition {
    pluginId: string;
    displayName: string;
    description: string;
    longDescription?: string;
    fields: Record<string, PluginSetupFieldDefinition>;
    sections: PluginSetupSectionDefinition[];
    setupSummary: PluginSetupReviewSummarySection[];
    reviewErrors: PluginSetupValidationIssue[];
}

export interface PluginSetupWizardRenderProps {
    plugin: PluginSetupRenderDefinition;
    values: Record<string, unknown>;
    generalErrors: string[];
    semesterId?: string;
    programId?: string;
    getFieldError: (fieldPath: string) => string | null;
    onValueChange: (fieldPath: string, value: unknown) => void;
}

export interface PluginSetupReviewRenderProps {
    plugin: PluginSetupRenderDefinition;
    values: Record<string, unknown>;
    semesterId?: string;
    programId?: string;
}

type PluginSetupFieldValidator<TFields extends Record<string, PluginSetupFieldDefinition> = Record<string, PluginSetupFieldDefinition>> = (
    value: unknown,
    context: PluginSetupValidationContext<TFields>,
) => string | PluginSetupValidationIssue | null | undefined;

export type PluginSetupValidator<TFields extends Record<string, PluginSetupFieldDefinition> = Record<string, PluginSetupFieldDefinition>> = (
    context: PluginSetupValidationContext<TFields>,
) => PluginSetupValidationIssue | PluginSetupValidationIssue[] | null | undefined | Promise<PluginSetupValidationIssue | PluginSetupValidationIssue[] | null | undefined>;

// ─── Field naming convention note (P-07 / P-13) ──────────────────────────────
// Frontend field props use camelCase (e.g. `settingsKey`, `defaultValue`,
// `summaryLabels`).  These are intentionally different from the backend Python
// snake_case names (`settings_key`, `default_value`, `summary_labels`).
// The adapter layer that bridges the two styles lives exclusively in
// `serializePluginSetupDefinition` below.  Do NOT mix snake_case into these
// TypeScript interfaces — all serialization must go through that adapter.
//
// ─── Setup vs Settings system boundary note (P-08) ────────────────────────────
// This file owns the **Setup** system: fields filled once during semester
// creation and stored via tab-settings at the plugin's designated `settingsKey`.
// The **Settings** system (see `pluginSettingsFields.tsx`) handles runtime
// settings that can be changed at any time.  The two systems share field types
// but are intentionally kept separate.  Do NOT reuse the same field `path`/
// `settingsKey` across both systems for the same plugin.
interface PluginSetupFieldBase<TType extends PluginSetupFieldType, TValue> {
    type: TType;
    settingsKey: string;
    label: string;
    required?: boolean;
    description?: string;
    placeholder?: string;
    defaultValue?: TValue;
    summaryLabels?: PluginSetupSummaryLabels;
    validate?: PluginSetupFieldValidator;
}

export interface PluginSetupTextFieldDefinition extends PluginSetupFieldBase<"text", string> {}

export interface PluginSetupTextareaFieldDefinition extends PluginSetupFieldBase<"textarea", string> {}

export interface PluginSetupNumberFieldDefinition extends PluginSetupFieldBase<"number", number> {}

export interface PluginSetupBooleanFieldDefinition extends PluginSetupFieldBase<"boolean", boolean> {}

export interface PluginSetupSelectFieldDefinition extends PluginSetupFieldBase<"select", string> {
    options: Array<{ label: string; value: string }>;
}

export interface PluginSetupDateFieldDefinition extends PluginSetupFieldBase<"date", string> {}

export interface PluginSetupJsonFieldDefinition extends PluginSetupFieldBase<"json", unknown> {}

export type PluginSetupFieldDefinition =
    | PluginSetupTextFieldDefinition
    | PluginSetupTextareaFieldDefinition
    | PluginSetupNumberFieldDefinition
    | PluginSetupBooleanFieldDefinition
    | PluginSetupSelectFieldDefinition
    | PluginSetupDateFieldDefinition
    | PluginSetupJsonFieldDefinition;

export interface PluginSetupSectionDefinition {
    id: string;
    title: string;
    description?: string;
    fieldKeys: string[];
}

export interface PluginSetupSectionProps {
    id: string;
    title: string;
    description?: string;
    children?: ReactNode;
}

interface PluginSetupDeclarativeFieldPropsBase<TType extends PluginSetupFieldType, TValue> extends Omit<PluginSetupFieldBase<TType, TValue>, "type"> {
    path: string;
}

export interface PluginSetupTextFieldProps extends PluginSetupDeclarativeFieldPropsBase<"text", string> {}

export interface PluginSetupTextareaFieldProps extends PluginSetupDeclarativeFieldPropsBase<"textarea", string> {}

export interface PluginSetupNumberFieldProps extends PluginSetupDeclarativeFieldPropsBase<"number", number> {}

export interface PluginSetupBooleanFieldProps extends PluginSetupDeclarativeFieldPropsBase<"boolean", boolean> {}

export interface PluginSetupSelectFieldProps extends PluginSetupDeclarativeFieldPropsBase<"select", string> {
    options: Array<{ label: string; value: string }>;
}

export interface PluginSetupDateFieldProps extends PluginSetupDeclarativeFieldPropsBase<"date", string> {}

export interface PluginSetupJsonFieldProps extends PluginSetupDeclarativeFieldPropsBase<"json", unknown> {}

export interface PluginSetupUiDefinition {
    setupComponent?: ComponentType<PluginSetupWizardRenderProps>;
    reviewComponent?: ComponentType<PluginSetupReviewRenderProps>;
}

export interface PluginSetupDefinition<TFields extends Record<string, PluginSetupFieldDefinition> = Record<string, PluginSetupFieldDefinition>> {
    content?: ReactNode;
    readonly fields: TFields;
    readonly sections: PluginSetupSectionDefinition[];
    ui?: PluginSetupUiDefinition;
    validate?: PluginSetupValidator<TFields>;
}

type ValueOfField<TField extends PluginSetupFieldDefinition> =
    TField extends PluginSetupBooleanFieldDefinition ? boolean
        : TField extends PluginSetupNumberFieldDefinition ? number
            : TField extends PluginSetupJsonFieldDefinition ? unknown
                : string;

export type InferPluginSetupValues<TDefinition extends PluginSetupDefinition> = {
    [TKey in keyof TDefinition["fields"]]: ValueOfField<TDefinition["fields"][TKey]>
};

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

const createDeclarativeComponent = <TProps,>(displayName: string) => {
    const Component = (_props: TProps) => null;
    Component.displayName = displayName;
    return Component;
};

export const PluginSetupSection = createDeclarativeComponent<PluginSetupSectionProps>("PluginSetupSection");
export const PluginSetupTextField = createDeclarativeComponent<PluginSetupTextFieldProps>("PluginSetupTextField");
export const PluginSetupTextareaField = createDeclarativeComponent<PluginSetupTextareaFieldProps>("PluginSetupTextareaField");
export const PluginSetupNumberField = createDeclarativeComponent<PluginSetupNumberFieldProps>("PluginSetupNumberField");
export const PluginSetupBooleanField = createDeclarativeComponent<PluginSetupBooleanFieldProps>("PluginSetupBooleanField");
export const PluginSetupSelectField = createDeclarativeComponent<PluginSetupSelectFieldProps>("PluginSetupSelectField");
export const PluginSetupDateField = createDeclarativeComponent<PluginSetupDateFieldProps>("PluginSetupDateField");
export const PluginSetupJsonField = createDeclarativeComponent<PluginSetupJsonFieldProps>("PluginSetupJsonField");

const normalizeValidationIssue = (
    issue: string | PluginSetupValidationIssue | null | undefined,
    fieldPath?: string,
): PluginSetupValidationIssue[] => {
    if (!issue) {
        return [];
    }
    if (typeof issue === "string") {
        return [{ fieldPath, message: issue }];
    }
    return [{
        ...issue,
        fieldPath: issue.fieldPath ?? fieldPath,
    }];
};

const isMissingSetupValue = (field: PluginSetupFieldDefinition, value: unknown) => {
    if (value == null) {
        return true;
    }
    if (field.type === "text" || field.type === "textarea" || field.type === "select" || field.type === "date") {
        return typeof value === "string" && value.trim() === "";
    }
    return false;
};

export const resolvePluginSetupValues = <TFields extends Record<string, PluginSetupFieldDefinition>>(
    definition: PluginSetupDefinition<TFields>,
    values: Record<string, unknown>,
): Record<string, unknown> => {
    return Object.fromEntries(
        Object.entries(definition.fields).map(([fieldKey, field]) => (
            hasOwn(values, fieldKey)
                ? [fieldKey, values[fieldKey]]
                : [fieldKey, field.defaultValue ?? null]
        )),
    );
};

// ─── Frontend validation note (P-12) ─────────────────────────────────────────
// This function implements frontend-side validation for Setup fields.  The
// backend (`plugin_registry.py:_validate_plugin_setup_values`) also validates
// independently on every API call.  Both sides MUST stay consistent:
//
//   • `required` fields → enforced on both sides
//   • Per-field `validate` callbacks → frontend only (UX convenience)
//   • `validation_rules` from setup schema → backend only (structural integrity)
//
// If you add a new validation rule type to the backend schema, consider whether
// a corresponding frontend check should be added here too, and vice versa.
// A future contract-test in CI should enforce this consistency (see P-12).
export const validatePluginSetupDefinition = async <TFields extends Record<string, PluginSetupFieldDefinition>>(
    definition: PluginSetupDefinition<TFields>,
    values: Record<string, unknown>,
): Promise<PluginSetupValidationIssue[]> => {
    const resolvedValues = resolvePluginSetupValues(definition, values);
    const validationContext: PluginSetupValidationContext<TFields> = {
        fields: definition.fields,
        values: resolvedValues,
    };
    const issues: PluginSetupValidationIssue[] = [];

    for (const [fieldKey, field] of Object.entries(definition.fields)) {
        const value = resolvedValues[fieldKey];
        if (field.required && isMissingSetupValue(field, value)) {
            issues.push({
                fieldPath: fieldKey,
                message: `${field.label} is required.`,
            });
        }
        if (field.validate) {
            issues.push(...normalizeValidationIssue(field.validate(value, validationContext), fieldKey));
        }
    }

    if (definition.validate) {
        const definitionIssues = await definition.validate(validationContext);
        if (Array.isArray(definitionIssues)) {
            definitionIssues.forEach((issue) => {
                issues.push(...normalizeValidationIssue(issue));
            });
        } else {
            issues.push(...normalizeValidationIssue(definitionIssues));
        }
    }

    return issues;
};

const flattenElements = (children: ReactNode): ReactElement[] => {
    const elements: ReactElement[] = [];
    Children.forEach(children, (child) => {
        if (!isValidElement(child)) {
            return;
        }
        if (child.type === Fragment) {
            elements.push(...flattenElements((child as ReactElement<{ children?: ReactNode }>).props.children));
            return;
        }
        elements.push(child);
    });
    return elements;
};

const cloneFieldOptions = (field: PluginSetupFieldDefinition) => (
    "options" in field && Array.isArray(field.options) ? [...field.options] : []
);

type FieldTypeMapping = {
    type: PluginSetupFieldType;
    defaultValueGuard: (value: unknown) => unknown;
};

const FIELD_TYPE_MAP = new Map<unknown, FieldTypeMapping>([
    [PluginSetupTextField, { type: 'text', defaultValueGuard: (v) => typeof v === 'string' ? v : undefined }],
    [PluginSetupTextareaField, { type: 'textarea', defaultValueGuard: (v) => typeof v === 'string' ? v : undefined }],
    [PluginSetupNumberField, { type: 'number', defaultValueGuard: (v) => typeof v === 'number' ? v : undefined }],
    [PluginSetupBooleanField, { type: 'boolean', defaultValueGuard: (v) => typeof v === 'boolean' ? v : undefined }],
    [PluginSetupSelectField, { type: 'select', defaultValueGuard: (v) => typeof v === 'string' ? v : undefined }],
    [PluginSetupDateField, { type: 'date', defaultValueGuard: (v) => typeof v === 'string' ? v : undefined }],
    [PluginSetupJsonField, { type: 'json', defaultValueGuard: (v) => v }],
]);

const toFieldDefinition = (
    element: ReactElement,
): { path: string; definition: PluginSetupFieldDefinition } => {
    const fieldProps = element.props as Record<string, unknown>;
    const path = String(fieldProps.path ?? "").trim();
    if (!path) {
        throw new Error("[plugin-system] Setup fields must declare a non-empty path.");
    }

    const settingsKey = String(fieldProps.settingsKey ?? "").trim();
    if (!settingsKey) {
        throw new Error(`[plugin-system] Setup field "${path}" must declare a non-empty settingsKey.`);
    }

    const mapping = FIELD_TYPE_MAP.get(element.type);
    if (!mapping) {
        throw new Error("[plugin-system] Setup sections can only contain host-provided setup field components.");
    }

    const baseDefinition = {
        settingsKey,
        label: String(fieldProps.label ?? path),
        required: Boolean(fieldProps.required),
        description: typeof fieldProps.description === "string" ? fieldProps.description : undefined,
        placeholder: typeof fieldProps.placeholder === "string" ? fieldProps.placeholder : undefined,
        summaryLabels: (fieldProps.summaryLabels as PluginSetupSummaryLabels | undefined) ?? undefined,
        validate: fieldProps.validate as PluginSetupFieldValidator | undefined,
    };

    const definition: Record<string, unknown> = {
        type: mapping.type,
        ...baseDefinition,
        defaultValue: mapping.defaultValueGuard(fieldProps.defaultValue),
    };

    // Select fields carry inline options.
    if (mapping.type === 'select') {
        const options = Array.isArray(fieldProps.options) ? fieldProps.options as Array<{ label: string; value: string }> : [];
        definition.options = [...options];
    }

    return { path, definition: definition as unknown as PluginSetupFieldDefinition };
};

const extractSetupSchema = (
    content: ReactNode,
): {
    fields: Record<string, PluginSetupFieldDefinition>;
    sections: PluginSetupSectionDefinition[];
} => {
    const fields: Record<string, PluginSetupFieldDefinition> = {};
    const sections = flattenElements(content).map((sectionElement) => {
        if (sectionElement.type !== PluginSetupSection) {
            throw new Error("[plugin-system] Plugin setup content must be composed from PluginSetupSection components.");
        }
        const sectionProps = sectionElement.props as PluginSetupSectionProps;
        const sectionId = sectionProps.id.trim();
        if (!sectionId) {
            throw new Error("[plugin-system] Setup sections must declare a non-empty id.");
        }
        const sectionTitle = sectionProps.title.trim();
        if (!sectionTitle) {
            throw new Error(`[plugin-system] Setup section "${sectionId}" must declare a non-empty title.`);
        }

        const fieldKeys = flattenElements(sectionProps.children).map((fieldElement) => {
            const { path, definition } = toFieldDefinition(fieldElement);
            if (fields[path]) {
                throw new Error(`[plugin-system] Duplicate setup field path "${path}".`);
            }
            fields[path] = definition;
            return path;
        });

        if (fieldKeys.length === 0) {
            throw new Error(`[plugin-system] Setup section "${sectionId}" must include at least one field component.`);
        }

        return {
            id: sectionId,
            title: sectionTitle,
            description: sectionProps.description,
            fieldKeys,
        };
    });

    return { fields, sections };
};

export const definePluginSetup = <TFields extends Record<string, PluginSetupFieldDefinition>>(
    definition: Omit<PluginSetupDefinition<TFields>, "fields" | "sections"> & { content: ReactNode },
): PluginSetupDefinition<TFields> => {
    const schema = extractSetupSchema(definition.content);
    return {
        content: definition.content,
        fields: schema.fields as TFields,
        sections: schema.sections,
        ui: definition.ui ? { ...definition.ui } : undefined,
        validate: definition.validate,
    };
};

// ─── Serialization / adapter layer (P-07 / P-13) ─────────────────────────────
// This is the ONLY place where frontend camelCase field names are converted to
// backend snake_case names.  All callers of this function receive a payload
// compatible with `PluginDescriptorSetupSchema` (backend JSON manifest format).
// Never add snake_case keys to the TypeScript interfaces above; keep the
// conversion centralised here.
export const serializePluginSetupDefinition = <TFields extends Record<string, PluginSetupFieldDefinition>>(
    definition: PluginSetupDefinition<TFields>,
): PluginDescriptorSetupSchema => ({
    sections: definition.sections.map((sectionDefinition) => ({
        id: sectionDefinition.id,
        title: sectionDefinition.title,
        description: sectionDefinition.description ?? "",
        fields: sectionDefinition.fieldKeys.map((fieldKey) => {
            const field = definition.fields[fieldKey];
            if (!field) {
                throw new Error(`Missing setup field "${fieldKey}" while serializing setup section "${sectionDefinition.id}".`);
            }
            return {
                path: fieldKey,
                // camelCase → snake_case adapter (P-07): these renames are intentional.
                settings_key: field.settingsKey,
                label: field.label,
                type: field.type,
                required: Boolean(field.required),
                default_value: field.defaultValue ?? null,
                description: field.description ?? "",
                placeholder: field.placeholder ?? "",
                options: cloneFieldOptions(field),
                summary_labels: { ...(field.summaryLabels ?? {}) },
            };
        }),
    })),
    validation_rules: [],
});

export const createPluginSetupBinding = <TFields extends Record<string, PluginSetupFieldDefinition>>(
    definition: PluginSetupDefinition<TFields>,
) => ({
    schema: serializePluginSetupDefinition(definition),
    ui: definition.ui?.setupComponent || definition.ui?.reviewComponent ? { ...definition.ui } : undefined,
    validate: async (values: Record<string, unknown>) => validatePluginSetupDefinition(definition, values),
});
