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

interface PluginSetupFieldBase<TType extends PluginSetupFieldType, TValue> {
    type: TType;
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

const toFieldDefinition = (
    element: ReactElement,
): { path: string; definition: PluginSetupFieldDefinition } => {
    const fieldProps = element.props as Record<string, unknown>;
    const path = String(fieldProps.path ?? "").trim();
    if (!path) {
        throw new Error("[plugin-system] Setup fields must declare a non-empty path.");
    }

    const baseDefinition = {
        label: String(fieldProps.label ?? path),
        required: Boolean(fieldProps.required),
        description: typeof fieldProps.description === "string" ? fieldProps.description : undefined,
        placeholder: typeof fieldProps.placeholder === "string" ? fieldProps.placeholder : undefined,
        summaryLabels: (fieldProps.summaryLabels as PluginSetupSummaryLabels | undefined) ?? undefined,
        validate: fieldProps.validate as PluginSetupFieldValidator | undefined,
    };

    if (element.type === PluginSetupTextField) {
        return { path, definition: { type: "text", ...baseDefinition, defaultValue: typeof fieldProps.defaultValue === "string" ? fieldProps.defaultValue : undefined } };
    }
    if (element.type === PluginSetupTextareaField) {
        return { path, definition: { type: "textarea", ...baseDefinition, defaultValue: typeof fieldProps.defaultValue === "string" ? fieldProps.defaultValue : undefined } };
    }
    if (element.type === PluginSetupNumberField) {
        return { path, definition: { type: "number", ...baseDefinition, defaultValue: typeof fieldProps.defaultValue === "number" ? fieldProps.defaultValue : undefined } };
    }
    if (element.type === PluginSetupBooleanField) {
        return { path, definition: { type: "boolean", ...baseDefinition, defaultValue: typeof fieldProps.defaultValue === "boolean" ? fieldProps.defaultValue : undefined } };
    }
    if (element.type === PluginSetupSelectField) {
        const options = Array.isArray(fieldProps.options) ? fieldProps.options as Array<{ label: string; value: string }> : [];
        return {
            path,
            definition: {
                type: "select",
                ...baseDefinition,
                defaultValue: typeof fieldProps.defaultValue === "string" ? fieldProps.defaultValue : undefined,
                options: [...options],
            },
        };
    }
    if (element.type === PluginSetupDateField) {
        return { path, definition: { type: "date", ...baseDefinition, defaultValue: typeof fieldProps.defaultValue === "string" ? fieldProps.defaultValue : undefined } };
    }
    if (element.type === PluginSetupJsonField) {
        return { path, definition: { type: "json", ...baseDefinition, defaultValue: fieldProps.defaultValue } };
    }

    throw new Error("[plugin-system] Setup sections can only contain host-provided setup field components.");
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
