// input:  [plugin setup registry definitions, semester setup/review API payloads, local draft values, and shared shadcn/plugin management primitives]
// output: [`PluginSetupStepRenderer` and `PluginSetupReviewRenderer` components]
// pos:    [Shared bridge that renders either host-owned DSL setup/review surfaces or plugin-owned custom setup/review components inside the Semester wizard with shadcn-aligned setup section shells]
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
  type PluginSetupPersist,
  type PluginSetupRenderDefinition,
  type PluginSetupReviewSummarySection,
  type PluginSetupValidationIssue,
} from "@/plugin-system";
import type { PluginSystemSemesterSetupPlugin, ProgramPluginSetupField, ProgramPluginSetupSection, SemesterDraftReviewIssue, SemesterPluginActivation } from "@/services/api";

import { Card, CardContent } from "@/components/ui/card";
import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";

import { PluginFieldControl } from "./PluginFieldControl";

const mapApiFieldToDefinition = (field: ProgramPluginSetupField): PluginSetupFieldDefinition => ({
  type: (field.type ?? "text") as PluginSetupFieldType,
  label: field.label ?? field.path,
  persist: (field.persist ?? "setupState") as PluginSetupPersist,
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
    <div className="space-y-6">
      {generalErrors.length > 0 ? (
        <div className="space-y-3">
          {generalErrors.map((message, index) => (
            <Card key={`${plugin.plugin_id}:general-error:${index}`} size="sm" className="border-amber-500/30 shadow-none">
              <CardContent className="text-sm text-muted-foreground">{message}</CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="space-y-6">
        {plugin.setup_sections.map((section, sectionIndex) => (
          <div key={section.id} className="space-y-4">
            {sectionIndex > 0 ? <Separator /> : null}
            <FieldSet className="gap-4">
              <div className="space-y-1">
                <FieldLegend>{section.title}</FieldLegend>
                {section.description ? (
                  <FieldDescription>{section.description}</FieldDescription>
                ) : null}
              </div>
              <FieldGroup className="gap-4">
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
              </FieldGroup>
            </FieldSet>
          </div>
        ))}
      </div>
    </div>
  );
};

export const PluginSetupStepRenderer: React.FC<{
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

  if (definition?.ui.kind === "custom") {
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
  <div className="space-y-6">
    {summary.map((section, sectionIndex) => (
      <div key={section.id} className="space-y-3">
        {sectionIndex > 0 ? <Separator /> : null}
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">{section.title}</div>
          {section.description ? <div className="text-sm text-muted-foreground">{section.description}</div> : null}
        </div>
        <div className="space-y-2">
          {section.items.map((item) => (
            <div key={`${section.id}:${item.path}`} className="flex flex-col items-start gap-2 rounded-lg border border-border/70 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium text-foreground sm:text-right">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export const PluginSetupReviewRenderer: React.FC<{
  plugin: SemesterPluginActivation;
  values: Record<string, unknown>;
}> = ({
  plugin,
  values,
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

  if (definition?.ui.kind === "custom") {
    const CustomReviewComponent = definition.ui.reviewComponent;
    return (
      <CustomReviewComponent
        plugin={renderPlugin}
        values={resolvePluginSetupValues(definition, values)}
      />
    );
  }

  return <DefaultPluginSetupReviewView summary={plugin.setup_summary ?? []} />;
};
