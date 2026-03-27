// input:  [plugin-authored setup field/section declarations]
// output: [setup DSL types, field helpers, section helper, and `definePluginSetup` registration helper]
// pos:    [Pure authoring DSL for host-rendered plugin setup definitions that can be validated, serialized, and consumed without React runtime dependencies]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export type PluginSetupPersist = "setupState" | "semesterOverride" | "both";
export type PluginSetupFieldType = "text" | "textarea" | "number" | "boolean" | "select" | "date" | "json";

type PluginSetupSummaryLabels = Record<string, string>;

interface PluginSetupFieldBase<TType extends PluginSetupFieldType, TValue> {
    type: TType;
    label: string;
    persist: PluginSetupPersist;
    required?: boolean;
    description?: string;
    placeholder?: string;
    defaultValue?: TValue;
    summaryLabels?: PluginSetupSummaryLabels;
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

export interface PluginSetupDefinition<TFields extends Record<string, PluginSetupFieldDefinition> = Record<string, PluginSetupFieldDefinition>> {
    fields: TFields;
    sections: PluginSetupSectionDefinition[];
}

type ValueOfField<TField extends PluginSetupFieldDefinition> =
    TField extends PluginSetupBooleanFieldDefinition ? boolean
        : TField extends PluginSetupNumberFieldDefinition ? number
            : TField extends PluginSetupJsonFieldDefinition ? unknown
                : string;

export type InferPluginSetupValues<TDefinition extends PluginSetupDefinition> = {
    [TKey in keyof TDefinition["fields"]]: ValueOfField<TDefinition["fields"][TKey]>
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
});
