// input:  [plugin settings panel scope context, TanStack Query cache, tab-settings APIs, and shadcn field primitives]
// output: [bound plugin-settings bucket hooks plus host-provided common field templates with inline source hint and reset]
// pos:    [frontend-only plugin settings binding layer that lets settings.tsx panels reuse tab-settings persistence and inherited-source metadata without manual query/update plumbing]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useEffect, useId, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";

import { getCourseDetailQueryOptions } from "@/data/resources/courses";
import { getProgramDetailQueryOptions, invalidateProgramDetailQuery, setProgramDetailQueryData } from "@/data/resources/programs";
import { getSemesterDetailQueryOptions, setSemesterDetailQueryData } from "@/data/resources/semesters";
import { TabSettingSourceHint } from "@/components/settings/TabSettingSourceHint";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import api, { type Course, type Program, type Semester, type TabSetting } from "@/services/api";
import type { PluginSettingsScope } from "@/services/pluginSettingsRegistry";

import { getDefaultSettingSource, getSettingSource, type SettingSource, type TabSettingsMeta } from "./tabSettingsMeta";
import { usePluginSettingsPanelContext } from "./pluginSettingsPanelContext";

type SettingsEntity = Program | Semester | Course;
type SettingsEntityKind = PluginSettingsScope["kind"];
type SelectOption = {
  label: string;
  value: string;
};

export interface PluginSettingsBucketState {
  pluginId: string;
  settingsKey: string;
  scope: PluginSettingsScope;
  isLoading: boolean;
  isSaving: boolean;
  tabSetting: TabSetting | null;
  resolvedSettings: Record<string, unknown>;
  scopeSettings: Record<string, unknown>;
  inheritedSettings: Record<string, unknown>;
  settingsMeta: TabSettingsMeta;
  refresh: () => void;
  setSettings: (nextSettings: Record<string, unknown>) => Promise<void>;
  updateField: (fieldPath: string, value: unknown) => Promise<void>;
  resetField: (fieldPath: string) => Promise<void>;
}

export interface PluginSettingsFieldState<TValue = unknown> {
  fieldPath: string;
  value: TValue | null;
  source: SettingSource;
  isOverriddenInScope: boolean;
  setValue: (value: TValue) => Promise<void>;
  reset: () => Promise<void>;
  bucket: PluginSettingsBucketState;
}

interface PluginSettingsBoundFieldBaseProps {
  settingsKey: string;
  fieldPath: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  placeholder?: string;
}

interface PluginSettingsTextFieldProps extends PluginSettingsBoundFieldBaseProps {}
interface PluginSettingsTextareaFieldProps extends PluginSettingsBoundFieldBaseProps {}
interface PluginSettingsNumberFieldProps extends PluginSettingsBoundFieldBaseProps {}
interface PluginSettingsBooleanFieldProps extends PluginSettingsBoundFieldBaseProps {}
interface PluginSettingsDateFieldProps extends PluginSettingsBoundFieldBaseProps {}
interface PluginSettingsJsonFieldProps extends PluginSettingsBoundFieldBaseProps {}
interface PluginSettingsSelectFieldProps extends PluginSettingsBoundFieldBaseProps {
  options: SelectOption[];
}

const parseSettingsObject = (value: unknown): Record<string, unknown> => {
  if (!value) {
    return {};
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
};

const buildSettingsMeta = (tabSetting: TabSetting | null): TabSettingsMeta => ({
  scopeSettings: tabSetting?.scope_settings ?? {},
  inheritedSettings: tabSetting?.inherited_settings ?? {},
  settingSources: tabSetting?.setting_sources ?? {},
});

const upsertTabSetting = (
  tabSettings: TabSetting[] | undefined,
  nextTabSetting: TabSetting,
): TabSetting[] => {
  const current = [...(tabSettings ?? [])];
  const index = current.findIndex((entry) => entry.settings_key === nextTabSetting.settings_key);
  if (index >= 0) {
    current[index] = nextTabSetting;
    return current;
  }
  current.push(nextTabSetting);
  return current;
};

const updateSettingsEntity = (
  entity: SettingsEntity | null | undefined,
  nextTabSetting: TabSetting,
): SettingsEntity | null | undefined => {
  if (!entity) {
    return entity;
  }
  return {
    ...entity,
    tab_settings: upsertTabSetting(entity.tab_settings, nextTabSetting),
  };
};

const setCourseDetailQueryData = (
  queryClient: ReturnType<typeof useQueryClient>,
  courseId: string,
  updater: (current: Course | null | undefined) => Course | null | undefined,
) => {
  queryClient.setQueryData<Course | null | undefined>(["courses", "detail", courseId], updater);
};

const useSettingsEntityQuery = (scope: PluginSettingsScope) => {
  const programQuery = useQuery({
    ...getProgramDetailQueryOptions(scope.kind === "program" ? scope.programId : "__missing__"),
    enabled: scope.kind === "program",
  });
  const semesterQuery = useQuery({
    ...getSemesterDetailQueryOptions(scope.kind === "semester" ? scope.semesterId : "__missing__"),
    enabled: scope.kind === "semester",
  });
  const courseQuery = useQuery({
    ...getCourseDetailQueryOptions(scope.kind === "course" ? scope.courseId : "__missing__"),
    enabled: scope.kind === "course",
  });

  if (scope.kind === "program") {
    return {
      entity: programQuery.data ?? null,
      isLoading: programQuery.isLoading,
      refetch: programQuery.refetch,
    };
  }
  if (scope.kind === "semester") {
    return {
      entity: semesterQuery.data ?? null,
      isLoading: semesterQuery.isLoading,
      refetch: semesterQuery.refetch,
    };
  }
  return {
    entity: courseQuery.data ?? null,
    isLoading: courseQuery.isLoading,
    refetch: courseQuery.refetch,
  };
};

const applyScopeEntityUpdate = (
  queryClient: ReturnType<typeof useQueryClient>,
  scope: PluginSettingsScope,
  nextTabSetting: TabSetting,
) => {
  if (scope.kind === "program") {
    setProgramDetailQueryData(queryClient, scope.programId, (current) => updateSettingsEntity(current, nextTabSetting) as Program | null | undefined);
    return;
  }
  if (scope.kind === "semester") {
    setSemesterDetailQueryData(queryClient, scope.semesterId, (current) => updateSettingsEntity(current, nextTabSetting) as Semester | null | undefined);
    return;
  }
  setCourseDetailQueryData(queryClient, scope.courseId, (current) => updateSettingsEntity(current, nextTabSetting) as Course | null | undefined);
};

const persistScopeSettings = async (
  scope: PluginSettingsScope,
  settingsKey: string,
  nextSettings: Record<string, unknown>,
): Promise<TabSetting> => {
  const payload = { settings: JSON.stringify(nextSettings) };
  if (scope.kind === "program") {
    return api.upsertProgramTabSettings(scope.programId, settingsKey, payload);
  }
  if (scope.kind === "semester") {
    return api.upsertSemesterTabSettings(scope.semesterId, settingsKey, payload);
  }
  return api.upsertCourseTabSettings(scope.courseId, settingsKey, payload);
};

const invalidateScopeQuery = async (
  queryClient: ReturnType<typeof useQueryClient>,
  scope: PluginSettingsScope,
) => {
  if (scope.kind === "program") {
    await invalidateProgramDetailQuery(queryClient, scope.programId);
    return;
  }
  if (scope.kind === "semester") {
    await queryClient.invalidateQueries({ queryKey: ["semesters", "detail", scope.semesterId] });
    return;
  }
  await queryClient.invalidateQueries({ queryKey: ["courses", "detail", scope.courseId] });
};

const usePluginSettingsBucketInternal = (
  pluginId: string,
  scope: PluginSettingsScope,
  onRefresh: () => void,
  settingsKey: string,
): PluginSettingsBucketState => {
  const queryClient = useQueryClient();
  const { entity, isLoading, refetch } = useSettingsEntityQuery(scope);
  const [isSaving, setIsSaving] = React.useState(false);

  const tabSetting = useMemo(() => (
    entity?.tab_settings?.find((entry) => entry.settings_key === settingsKey) ?? null
  ), [entity?.tab_settings, settingsKey]);

  const resolvedSettings = useMemo(() => (
    parseSettingsObject(tabSetting?.resolved_settings ?? tabSetting?.settings)
  ), [tabSetting?.resolved_settings, tabSetting?.settings]);
  const scopeSettings = useMemo(() => tabSetting?.scope_settings ?? {}, [tabSetting?.scope_settings]);
  const inheritedSettings = useMemo(() => tabSetting?.inherited_settings ?? {}, [tabSetting?.inherited_settings]);
  const settingsMeta = useMemo(() => buildSettingsMeta(tabSetting), [tabSetting]);

  const setSettings = React.useCallback(async (nextSettings: Record<string, unknown>) => {
    setIsSaving(true);
    try {
      const nextTabSetting = await persistScopeSettings(scope, settingsKey, nextSettings);
      applyScopeEntityUpdate(queryClient, scope, nextTabSetting);
      await invalidateScopeQuery(queryClient, scope);
      onRefresh();
    } finally {
      setIsSaving(false);
    }
  }, [onRefresh, queryClient, scope, settingsKey]);

  const updateField = React.useCallback(async (fieldPath: string, value: unknown) => {
    await setSettings({
      ...scopeSettings,
      [fieldPath]: value,
    });
  }, [scopeSettings, setSettings]);

  const resetField = React.useCallback(async (fieldPath: string) => {
    const nextSettings = {
      ...scopeSettings,
    };
    delete nextSettings[fieldPath];
    await setSettings(nextSettings);
  }, [scopeSettings, setSettings]);

  return {
    pluginId,
    settingsKey,
    scope,
    isLoading,
    isSaving,
    tabSetting,
    resolvedSettings,
    scopeSettings,
    inheritedSettings,
    settingsMeta,
    refresh: () => {
      void refetch();
      onRefresh();
    },
    setSettings,
    updateField,
    resetField,
  };
};

export const usePluginSettingsBucket = (settingsKey: string): PluginSettingsBucketState => {
  const { pluginId, scope, onRefresh } = usePluginSettingsPanelContext();
  return usePluginSettingsBucketInternal(pluginId, scope, onRefresh, settingsKey);
};

export const usePluginSettingField = <TValue = unknown,>(
  settingsKey: string,
  fieldPath: string,
): PluginSettingsFieldState<TValue> => {
  const bucket = usePluginSettingsBucket(settingsKey);
  const source = useMemo(() => getSettingSource(bucket.settingsMeta, fieldPath), [bucket.settingsMeta, fieldPath]);

  return {
    fieldPath,
    value: (bucket.resolvedSettings[fieldPath] ?? null) as TValue | null,
    source,
    isOverriddenInScope: source.is_overridden_in_scope,
    setValue: async (value: TValue) => {
      await bucket.updateField(fieldPath, value);
    },
    reset: async () => {
      await bucket.resetField(fieldPath);
    },
    bucket,
  };
};

const formatJsonValue = (value: unknown) => {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const parseDateOrUndefined = (value: unknown) => {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const toIsoDate = (value?: Date) => (value ? format(value, "yyyy-MM-dd") : "");

const PluginSettingsFieldLabelRow: React.FC<{
  label: React.ReactNode;
  source: SettingSource;
  onReset: () => Promise<void>;
}> = ({ label, source, onReset }) => (
  <span className="inline-flex flex-wrap items-center gap-2">
    <span>{label}</span>
    <TabSettingSourceHint source={source} onReset={() => { void onReset(); }} />
  </span>
);

const PluginSettingsTextLikeField: React.FC<PluginSettingsBoundFieldBaseProps & {
  multiline?: boolean;
}> = ({
  settingsKey,
  fieldPath,
  label,
  description,
  placeholder,
  multiline = false,
}) => {
  const field = usePluginSettingField<string>(settingsKey, fieldPath);
  const fieldId = useId();

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={fieldId}>
        <PluginSettingsFieldLabelRow label={label} source={field.source} onReset={field.reset} />
      </FieldLabel>
      {multiline ? (
        <Textarea
          id={fieldId}
          value={field.value ?? ""}
          placeholder={placeholder}
          onChange={(event) => {
            void field.setValue(event.target.value);
          }}
        />
      ) : (
        <Input
          id={fieldId}
          value={field.value ?? ""}
          placeholder={placeholder}
          onChange={(event) => {
            void field.setValue(event.target.value);
          }}
        />
      )}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
};

export const PluginSettingsTextField: React.FC<PluginSettingsTextFieldProps> = (props) => (
  <PluginSettingsTextLikeField {...props} />
);

export const PluginSettingsTextareaField: React.FC<PluginSettingsTextareaFieldProps> = (props) => (
  <PluginSettingsTextLikeField {...props} multiline />
);

export const PluginSettingsNumberField: React.FC<PluginSettingsNumberFieldProps> = ({
  settingsKey,
  fieldPath,
  label,
  description,
  placeholder,
}) => {
  const field = usePluginSettingField<number | null>(settingsKey, fieldPath);
  const fieldId = useId();

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={fieldId}>
        <PluginSettingsFieldLabelRow label={label} source={field.source} onReset={field.reset} />
      </FieldLabel>
      <Input
        id={fieldId}
        type="number"
        value={field.value == null ? "" : String(field.value)}
        placeholder={placeholder}
        onChange={(event) => {
          const nextValue = event.target.value;
          void field.setValue(nextValue === "" ? null : Number(nextValue));
        }}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
};

export const PluginSettingsBooleanField: React.FC<PluginSettingsBooleanFieldProps> = ({
  settingsKey,
  fieldPath,
  label,
  description,
}) => {
  const field = usePluginSettingField<boolean>(settingsKey, fieldPath);
  const fieldId = useId();

  return (
    <Field orientation="responsive" className="gap-3 py-1">
      <FieldContent>
        <FieldLabel htmlFor={fieldId}>
          <PluginSettingsFieldLabelRow label={label} source={field.source} onReset={field.reset} />
        </FieldLabel>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </FieldContent>
      <Switch
        id={fieldId}
        checked={Boolean(field.value)}
        onCheckedChange={(checked) => {
          void field.setValue(checked);
        }}
        className="shrink-0"
      />
    </Field>
  );
};

export const PluginSettingsSelectField: React.FC<PluginSettingsSelectFieldProps> = ({
  settingsKey,
  fieldPath,
  label,
  description,
  placeholder,
  options,
}) => {
  const field = usePluginSettingField<string>(settingsKey, fieldPath);
  const fieldId = useId();

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={fieldId}>
        <PluginSettingsFieldLabelRow label={label} source={field.source} onReset={field.reset} />
      </FieldLabel>
      <Select
        value={field.value ?? ""}
        onValueChange={(value) => {
          void field.setValue(value);
        }}
      >
        <SelectTrigger id={fieldId}>
          <SelectValue placeholder={placeholder || "Select a value"} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
};

export const PluginSettingsDateField: React.FC<PluginSettingsDateFieldProps> = ({
  settingsKey,
  fieldPath,
  label,
  description,
  placeholder,
}) => {
  const field = usePluginSettingField<string>(settingsKey, fieldPath);
  const fieldId = useId();
  const selectedDate = parseDateOrUndefined(field.value);
  const dateLabel = selectedDate ? format(selectedDate, "PP") : placeholder || "Pick a date";

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={fieldId}>
        <PluginSettingsFieldLabelRow label={label} source={field.source} onReset={field.reset} />
      </FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={fieldId}
            type="button"
            variant="outline"
            data-empty={!selectedDate}
            className={cn(
              "w-full min-w-0 justify-start overflow-hidden text-left font-normal data-[empty=true]:text-muted-foreground",
            )}
          >
            <CalendarDays className="mr-2 size-4" />
            <span className="truncate">{dateLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            autoFocus
            mode="single"
            selected={selectedDate}
            onSelect={(nextDate) => {
              void field.setValue(toIsoDate(nextDate));
            }}
          />
        </PopoverContent>
      </Popover>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
};

export const PluginSettingsJsonField: React.FC<PluginSettingsJsonFieldProps> = ({
  settingsKey,
  fieldPath,
  label,
  description,
  placeholder,
}) => {
  const field = usePluginSettingField(settingsKey, fieldPath);
  const fieldId = useId();
  const [jsonDraft, setJsonDraft] = useState(() => formatJsonValue(field.value));
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    setJsonDraft(formatJsonValue(field.value));
    setJsonError(null);
  }, [field.value]);

  return (
    <Field className="gap-2" data-invalid={Boolean(jsonError) || undefined}>
      <FieldLabel htmlFor={fieldId}>
        <PluginSettingsFieldLabelRow label={label} source={field.source} onReset={field.reset} />
      </FieldLabel>
      <Textarea
        id={fieldId}
        value={jsonDraft}
        placeholder={placeholder || '{\n  "key": "value"\n}'}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setJsonDraft(nextDraft);
          if (nextDraft.trim() === "") {
            setJsonError(null);
            void field.setValue(null);
            return;
          }
          try {
            const parsed = JSON.parse(nextDraft);
            setJsonError(null);
            void field.setValue(parsed);
          } catch {
            setJsonError("Enter valid JSON.");
          }
        }}
        className="min-h-32 font-mono text-sm"
      />
      <FieldContent className="gap-1">
        {description ? <FieldDescription>{description}</FieldDescription> : null}
        {jsonError ? <FieldError>{jsonError}</FieldError> : null}
      </FieldContent>
    </Field>
  );
};
