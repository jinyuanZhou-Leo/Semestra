// input:  [plugin-authored setup field/section declarations plus optional custom setup/review React renderers]
// output: [setup contract types, field helpers, validation helpers, and `definePluginSetup` registration helper]
// pos:    [Plugin setup authoring layer that keeps backend-serializable field/section manifests stable while allowing either host-rendered DSL setup or plugin-rendered custom setup/review UIs]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { ComponentType } from "react";

export type PluginSetupPersist = "setupState" | "semesterOverride" | "both";
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
    getFieldError: (fieldPath: string) => string | null;
    onValueChange: (fieldPath: string, value: unknown) => void;
}

export interface PluginSetupReviewRenderProps {
    plugin: PluginSetupRenderDefinition;
    values: Record<string, unknown>;
}

type PluginSetupFieldValidator<TFields extends Record<string, PluginSetupFieldDefinition> = Record<string, PluginSetupFieldDefinition>> = (
    value: unknown,
    context: PluginSetupValidationContext<TFields>,
) => string | PluginSetupValidationIssue | null | undefined;

export type PluginSetupValidator<TFields extends Record<string, PluginSetupFieldDefinition> = Record<string, PluginSetupFieldDefinition>> = (
    context: PluginSetupValidationContext<TFields>,
) => PluginSetupValidationIssue | PluginSetupValidationIssue[] | null | undefined | Promise<PluginSetupValidationIssue | PluginSetupValidationIssue[] | null | undefined>;

interface PluginSetupFieldBase<TType extends PluginSetupFieldType, TValue> {
    type: TType;
    label: string;
    persist: PluginSetupPersist;
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

export interface PluginSetupDslUiDefinition {
    kind: "dsl";
}

export interface PluginSetupCustomUiDefinition {
    kind: "custom";
    setupComponent: ComponentType<PluginSetupWizardRenderProps>;
    reviewComponent: ComponentType<PluginSetupReviewRenderProps>;
}

export type PluginSetupUiDefinition = PluginSetupDslUiDefinition | PluginSetupCustomUiDefinition;

export interface PluginSetupDefinition<TFields extends Record<string, PluginSetupFieldDefinition> = Record<string, PluginSetupFieldDefinition>> {
    fields: TFields;
    sections: PluginSetupSectionDefinition[];
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

const DEFAULT_PLUGIN_SETUP_UI: PluginSetupDslUiDefinition = {
    kind: "dsl",
};

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

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

export const section = (
    id: string,
    definition: Omit<PluginSetupSectionDefinition, "id">,
): PluginSetupSectionDefinition => ({
    id,
    title: definition.title,
    description: definition.description,
    fieldKeys: [...definition.fieldKeys],
});

export const textField = (definition: Omit<PluginSetupTextFieldDefinition, "type">): PluginSetupTextFieldDefinition => ({
    type: "text",
    ...definition,
});

export const textareaField = (
    definition: Omit<PluginSetupTextareaFieldDefinition, "type">,
): PluginSetupTextareaFieldDefinition => ({
    type: "textarea",
    ...definition,
});

export const numberField = (
    definition: Omit<PluginSetupNumberFieldDefinition, "type">,
): PluginSetupNumberFieldDefinition => ({
    type: "number",
    ...definition,
});

export const booleanField = (
    definition: Omit<PluginSetupBooleanFieldDefinition, "type">,
): PluginSetupBooleanFieldDefinition => ({
    type: "boolean",
    ...definition,
});

export const selectField = (
    definition: Omit<PluginSetupSelectFieldDefinition, "type">,
): PluginSetupSelectFieldDefinition => ({
    type: "select",
    ...definition,
    options: [...definition.options],
});

export const dateField = (
    definition: Omit<PluginSetupDateFieldDefinition, "type">,
): PluginSetupDateFieldDefinition => ({
    type: "date",
    ...definition,
});

export const jsonField = (
    definition: Omit<PluginSetupJsonFieldDefinition, "type">,
): PluginSetupJsonFieldDefinition => ({
    type: "json",
    ...definition,
});

export const definePluginSetup = <TFields extends Record<string, PluginSetupFieldDefinition>>(
    definition: PluginSetupDefinition<TFields>,
): PluginSetupDefinition<TFields> => ({
    fields: definition.fields,
    sections: [...definition.sections],
    ui: definition.ui ?? DEFAULT_PLUGIN_SETUP_UI,
    validate: definition.validate,
});
