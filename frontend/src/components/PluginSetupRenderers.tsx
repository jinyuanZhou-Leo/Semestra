// input:  [plugin setup registry definitions, semester setup/review API payloads, local draft values, and shared shadcn/plugin management primitives]
// output: [`PluginSetupStepRenderer` and `PluginSetupReviewRenderer` components]
// pos:    [Shared bridge that renders host-owned DSL setup/review surfaces by default and falls back to plugin-owned setup/review override components inside the Semester wizard with wrapper-light shadcn-aligned setup section shells]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useMemo } from "react";

import {
  getPluginSetupDefinitionById,
  resolvePluginSetupValues,
  type PluginSetupFieldDefinition,
  type PluginSetupFieldType,
  type PluginSetupRenderDefinition,
  type PluginSetupReviewSummarySection,
  type PluginSetupValidationIssue,
} from "@/plugin-system";
import type { PluginSystemSemesterSetupPlugin, ProgramPluginSetupField, ProgramPluginSetupSection, SemesterDraftReviewIssue, SemesterPluginActivation } from "@/services/api";

import { PluginFieldControl } from "./PluginFieldControl";
import {
  PluginSetupFormReviewItem,
  PluginSetupFormSection,
  PluginSetupFormSurface,
} from "./PluginSetupForm";

const mapApiFieldToDefinition = (field: ProgramPluginSetupField): PluginSetupFieldDefinition => ({
  type: (field.type ?? "text") as PluginSetupFieldType,
  settingsKey: field.settings_key,
  label: field.label ?? field.path,
  required: Boolean(field.required),
  description: field.description ?? "",
  placeholder: field.placeholder ?? "",
  defaultValue: field.default_value ?? null,
  options: field.options ?? [],
  summaryLabels: field.summary_labels ?? {},
} as PluginSetupFieldDefinition);

const mapApiSectionsToDefinitions = (sections: ProgramPluginSetupSection[]) => ({
  fields: Object.fromEntries(
    sections.flatMap((section) => section.fields.map((field) => [field.path, mapApiFieldToDefinition(field)])),
  ) as Record<string, PluginSetupFieldDefinition>,
  sections: sections.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    fieldKeys: section.fields.map((field) => field.path),
  })),
});

const mapReviewIssue = (issue: SemesterDraftReviewIssue): PluginSetupValidationIssue => ({
  code: issue.code,
  fieldPath: issue.field_path ?? undefined,
  message: issue.message,
});

const buildRenderDefinition = ({
  pluginId,
  displayName,
  description,
  longDescription,
  apiSections,
  summary,
  reviewErrors,
}: {
  pluginId: string;
  displayName: string;
  description: string;
  longDescription?: string;
  apiSections: ProgramPluginSetupSection[];
  summary: PluginSetupReviewSummarySection[];
  reviewErrors: PluginSetupValidationIssue[];
}): PluginSetupRenderDefinition => {
  const definition = getPluginSetupDefinitionById(pluginId);
  const fallbackDefinition = mapApiSectionsToDefinitions(apiSections);

  return {
    pluginId,
    displayName,
    description,
    longDescription,
    fields: definition?.fields ?? fallbackDefinition.fields,
    sections: definition?.sections ?? fallbackDefinition.sections,
    setupSummary: summary,
    reviewErrors,
  };
};

const getGeneralErrors = (issues: PluginSetupValidationIssue[]) => issues
  .filter((issue) => !issue.fieldPath)
  .map((issue) => issue.message);

const getFieldErrorMap = (issues: PluginSetupValidationIssue[]) => {
  return new Map(
    issues
      .filter((issue) => issue.fieldPath)
      .map((issue) => [issue.fieldPath as string, issue.message]),
  );
};

const DefaultPluginSetupStepView: React.FC<{
  plugin: PluginSystemSemesterSetupPlugin;
  values: Record<string, unknown>;
  localErrors: PluginSetupValidationIssue[];
  onValueChange: (fieldPath: string, value: unknown) => void;
}> = ({
  plugin,
  values,
  localErrors,
  onValueChange,
}) => {
  const serverIssues = plugin.review_errors.map(mapReviewIssue);
  const fieldErrors = getFieldErrorMap([...serverIssues, ...localErrors]);
  const generalErrors = [...getGeneralErrors(serverIssues), ...getGeneralErrors(localErrors)];

  return (
    <PluginSetupFormSurface generalErrors={generalErrors}>
      {plugin.setup_sections.map((section, sectionIndex) => (
        <PluginSetupFormSection
          key={section.id}
          title={section.title}
          description={section.description}
          separated={sectionIndex > 0}
        >
          {section.fields.map((field) => (
            <PluginFieldControl
              key={`${plugin.plugin_id}:${section.id}:${field.path}`}
              field={field}
              value={values[field.path] ?? field.default_value}
              description={field.description}
              error={fieldErrors.get(field.path) ?? null}
              onChange={(nextValue) => onValueChange(field.path, nextValue)}
            />
          ))}
        </PluginSetupFormSection>
      ))}
    </PluginSetupFormSurface>
  );
};

export const PluginSetupStepRenderer: React.FC<{
  plugin: PluginSystemSemesterSetupPlugin;
  values: Record<string, unknown>;
  localErrors: PluginSetupValidationIssue[];
  semesterId?: string;
  programId?: string;
  onValueChange: (fieldPath: string, value: unknown) => void;
}> = ({
  plugin,
  values,
  localErrors,
  semesterId,
  programId,
  onValueChange,
}) => {
  const definition = getPluginSetupDefinitionById(plugin.plugin_id);
  const renderPlugin = useMemo(() => buildRenderDefinition({
    pluginId: plugin.plugin_id,
    displayName: plugin.display_name,
    description: plugin.description,
    longDescription: plugin.long_description,
    apiSections: plugin.setup_sections,
    summary: plugin.setup_summary,
    reviewErrors: plugin.review_errors.map(mapReviewIssue),
  }), [
    plugin.description,
    plugin.display_name,
    plugin.long_description,
    plugin.plugin_id,
    plugin.review_errors,
    plugin.setup_sections,
    plugin.setup_summary,
  ]);

  if (definition?.ui?.setupComponent) {
    const CustomSetupComponent = definition.ui.setupComponent;
    const resolvedValues = resolvePluginSetupValues(definition, values);
    const localFieldErrors = getFieldErrorMap(localErrors);
    const serverIssues = plugin.review_errors.map(mapReviewIssue);
    const serverFieldErrors = getFieldErrorMap(serverIssues);

    return (
      <CustomSetupComponent
        plugin={renderPlugin}
        values={resolvedValues}
        generalErrors={[...getGeneralErrors(serverIssues), ...getGeneralErrors(localErrors)]}
        semesterId={semesterId}
        programId={programId}
        getFieldError={(fieldPath) => localFieldErrors.get(fieldPath) ?? serverFieldErrors.get(fieldPath) ?? null}
        onValueChange={onValueChange}
      />
    );
  }

  return (
    <DefaultPluginSetupStepView
      plugin={plugin}
      values={values}
      localErrors={localErrors}
      onValueChange={onValueChange}
    />
  );
};

const DefaultPluginSetupReviewView: React.FC<{
  summary: PluginSetupReviewSummarySection[];
}> = ({ summary }) => (
  <PluginSetupFormSurface>
    {summary.map((section, sectionIndex) => (
      <PluginSetupFormSection
        key={section.id}
        title={section.title}
        description={section.description}
        separated={sectionIndex > 0}
      >
        {section.items.map((item) => (
          <PluginSetupFormReviewItem
            key={`${section.id}:${item.path}`}
            label={item.label}
            value={item.value}
          />
        ))}
      </PluginSetupFormSection>
    ))}
  </PluginSetupFormSurface>
);

export const PluginSetupReviewRenderer: React.FC<{
  plugin: SemesterPluginActivation;
  values: Record<string, unknown>;
  semesterId?: string;
  programId?: string;
}> = ({
  plugin,
  values,
  semesterId,
  programId,
}) => {
  const definition = getPluginSetupDefinitionById(plugin.plugin_id);
  const renderPlugin = useMemo(() => buildRenderDefinition({
    pluginId: plugin.plugin_id,
    displayName: plugin.display_name,
    description: plugin.description,
    longDescription: plugin.long_description,
    apiSections: plugin.setup_sections,
    summary: plugin.setup_summary ?? [],
    reviewErrors: (plugin.review_errors ?? []).map(mapReviewIssue),
  }), [
    plugin.description,
    plugin.display_name,
    plugin.long_description,
    plugin.plugin_id,
    plugin.review_errors,
    plugin.setup_sections,
    plugin.setup_summary,
  ]);

  if (definition?.ui?.reviewComponent) {
    const CustomReviewComponent = definition.ui.reviewComponent;
    return (
      <CustomReviewComponent
        plugin={renderPlugin}
        values={resolvePluginSetupValues(definition, values)}
        semesterId={semesterId}
        programId={programId}
      />
    );
  }

  return <DefaultPluginSetupReviewView summary={plugin.setup_summary ?? []} />;
};
