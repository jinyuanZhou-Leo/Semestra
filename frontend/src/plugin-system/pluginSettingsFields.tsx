// input:  [plugin settings panel scope context, TanStack Query cache, tab-settings APIs, and shadcn field primitives]
// output: [bound plugin-settings bucket hooks plus host-provided common field templates, including automatic inheritance source badges and reset for standard fields, and an opt-in PluginSettingsBucketSourceBanner for CRUD-style custom panels]
// pos:    [frontend-only plugin settings binding layer that lets settings.tsx panels reuse tab-settings persistence without manual query/update plumbing]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarDays, Clock3, RotateCcw } from "lucide-react";

import { getCourseDetailQueryOptions } from "@/data/resources/courses";
import { getProgramDetailQueryOptions } from "@/data/resources/programs";
import { getSemesterDetailQueryOptions } from "@/data/resources/semesters";

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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { PluginSettingsScope } from "@/services/pluginSettingsRegistry";

import { usePluginSettingsPanelContext } from "./pluginSettingsPanelContext";
import {
  applyScopeEntityUpdate,
  buildSettingsMeta,
  invalidateScopeQuery,
  parseSettingsObject,
  persistScopeSettings,
  type SettingsEntity,
} from "./pluginSettingsPersistence";
import { jsonDeepEqual } from './utils';
import {
  getSettingLayerLabel,
  getSettingResetLabel,
  getSettingSource,
  type SettingSource,
  type TabSettingsMeta,
} from "./tabSettingsMeta";

import type { TabSetting } from "@/services/api";

// ─── Setup vs Settings system boundary note (P-08) ────────────────────────────
// This file owns the **Settings** system: frontend-only binding layer that lets
// settings.tsx panels reuse tab-settings persistence and inherited-source metadata
// without manual query/update plumbing. It is used for runtime settings that can
// be changed at any time.
// The **Setup** system (see `setup.ts`) handles installation-time configuration
// during semester creation. The two systems share field types but are intentionally
// kept separate. Do NOT reuse the same field `path` or `settingsKey` across both
// systems for the same plugin.

type SelectOption = {
  label: string;
  value: string;
};

const bucketSaveQueueMap = new Map<string, Promise<void>>();
const bucketOptimisticScopeSettingsMap = new Map<string, Record<string, unknown>>();
const bucketPendingSaveCountMap = new Map<string, number>();

function buildPluginSettingsBucketKey(
  scope: PluginSettingsScope,
  settingsKey: string,
): string {
  if (scope.kind === "program") {
    return `program:${scope.programId}:${settingsKey}`;
  }
  if (scope.kind === "semester") {
    return `semester:${scope.semesterId}:${settingsKey}`;
  }
  return `course:${scope.courseId}:${settingsKey}`;
}

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
  /** Per-field inheritance metadata derived from `setting_sources`. Available to custom CRUD panels via `getSettingSource(bucket.settingsMeta, fieldPath)`. */
  settingsMeta: TabSettingsMeta;
  refresh: () => void;
  setSettings: (nextSettings: Record<string, unknown>) => Promise<void>;
  updateField: (fieldPath: string, value: unknown) => Promise<void>;
  /** Remove a field's override at this scope so it falls back to the inherited value. */
  resetField: (fieldPath: string) => Promise<void>;
}

export interface PluginSettingsFieldState<TValue = unknown> {
  fieldPath: string;
  value: TValue | null;
  /** Inheritance source for this field — layer, override status, and fallback layer. */
  source: SettingSource;
  setValue: (value: TValue) => Promise<void>;
  /** Removes this field's scope override, falling back to the inherited value. */
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

// ─── Time field utilities ──────────────────────────────────────────────────────

const TIME_INPUT_STEP_SECONDS = 60;
const TIME_INPUT_CLASS = 'appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none';

function minutesToTimeString(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.floor(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseTimeString(value: string): number | null {
  const matched = /^(\d{2}):(\d{2})$/.exec(value);
  if (!matched) return null;
  const h = Number(matched[1]);
  const m = Number(matched[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return (h * 60) + m;
}

interface PluginSettingsTextFieldProps extends PluginSettingsBoundFieldBaseProps { defaultValue?: string; }
interface PluginSettingsTextareaFieldProps extends PluginSettingsBoundFieldBaseProps { defaultValue?: string; }
interface PluginSettingsNumberFieldProps extends PluginSettingsBoundFieldBaseProps { defaultValue?: number; }
interface PluginSettingsBooleanFieldProps extends PluginSettingsBoundFieldBaseProps { defaultValue?: boolean; }
interface PluginSettingsDateFieldProps extends PluginSettingsBoundFieldBaseProps { defaultValue?: string; }
interface PluginSettingsJsonFieldProps extends PluginSettingsBoundFieldBaseProps { defaultValue?: unknown; }
interface PluginSettingsSelectFieldProps extends PluginSettingsBoundFieldBaseProps {
  options: SelectOption[];
  defaultValue?: string;
}
interface PluginSettingsTimeFieldProps extends PluginSettingsBoundFieldBaseProps {
  /** Default value in minutes from midnight (0–1439). */
  defaultValue?: number;
  /**
   * Override the save behavior on commit. Useful for cross-field validation
   * (e.g. clamping a day-start/end window). When omitted the field saves directly
   * via the bucket. When provided, the caller is responsible for persisting the value.
   */
  onCommit?: (minutes: number) => void | Promise<void>;
}

interface SettingsEntityQueryResult {
  entity: SettingsEntity | null;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
}

function useSettingsEntityQuery(scope: PluginSettingsScope): SettingsEntityQueryResult {
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
      entity: (programQuery.data as SettingsEntity | null) ?? null,
      isLoading: programQuery.isLoading,
      refetch: programQuery.refetch,
    };
  }
  if (scope.kind === "semester") {
    return {
      entity: (semesterQuery.data as SettingsEntity | null) ?? null,
      isLoading: semesterQuery.isLoading,
      refetch: semesterQuery.refetch,
    };
  }
  return {
    entity: (courseQuery.data as SettingsEntity | null) ?? null,
    isLoading: courseQuery.isLoading,
    refetch: courseQuery.refetch,
  };
}

function getFieldFallbackValue<TValue>(
  bucket: PluginSettingsBucketState,
  fieldPath: string,
  defaultValue: TValue | undefined,
): TValue | undefined {
  const inheritedValue = bucket.inheritedSettings[fieldPath];
  return (inheritedValue !== undefined ? inheritedValue : defaultValue) as TValue | undefined;
}

const usePluginSettingsBucketInternal = (
  pluginId: string,
  scope: PluginSettingsScope,
  onRefresh: () => void,
  settingsKey: string,
): PluginSettingsBucketState => {
  const queryClient = useQueryClient();
  const { entity, isLoading, refetch } = useSettingsEntityQuery(scope);
  const [isSaving, setIsSaving] = React.useState(false);
  const bucketKey = useMemo(() => buildPluginSettingsBucketKey(scope, settingsKey), [scope, settingsKey]);

  const tabSetting = useMemo(() => (
    entity?.tab_settings?.find((entry) => entry.settings_key === settingsKey) ?? null
  ), [entity?.tab_settings, settingsKey]);

  const resolvedSettings = useMemo(() => (
    parseSettingsObject(tabSetting?.resolved_settings ?? tabSetting?.settings)
  ), [tabSetting?.resolved_settings, tabSetting?.settings]);
  const scopeSettings = useMemo(() => tabSetting?.scope_settings ?? {}, [tabSetting?.scope_settings]);
  const inheritedSettings = useMemo(() => tabSetting?.inherited_settings ?? {}, [tabSetting?.inherited_settings]);
  const settingsMeta = useMemo(() => buildSettingsMeta(tabSetting), [tabSetting]);

  useEffect(() => {
    if ((bucketPendingSaveCountMap.get(bucketKey) ?? 0) === 0) {
      bucketOptimisticScopeSettingsMap.set(bucketKey, scopeSettings);
    }
  }, [bucketKey, scopeSettings]);

  const setSettings = React.useCallback(async (nextSettings: Record<string, unknown>) => {
    bucketOptimisticScopeSettingsMap.set(bucketKey, nextSettings);
    bucketPendingSaveCountMap.set(bucketKey, (bucketPendingSaveCountMap.get(bucketKey) ?? 0) + 1);
    setIsSaving(true);

    const queuedSave = (bucketSaveQueueMap.get(bucketKey) ?? Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        try {
          const optimisticSettings = bucketOptimisticScopeSettingsMap.get(bucketKey) ?? nextSettings;
          const nextTabSetting = await persistScopeSettings(
            scope,
            settingsKey,
            optimisticSettings,
          );
          applyScopeEntityUpdate(queryClient, scope, nextTabSetting);
          invalidateScopeQuery(queryClient, scope);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to save settings.";
          toast.error(message);
          throw error;
        } finally {
          const nextPendingCount = Math.max(0, (bucketPendingSaveCountMap.get(bucketKey) ?? 1) - 1);
          bucketPendingSaveCountMap.set(bucketKey, nextPendingCount);
          setIsSaving(nextPendingCount > 0);
        }
      });

    bucketSaveQueueMap.set(bucketKey, queuedSave.then(() => undefined, () => undefined));
    return queuedSave;
  }, [bucketKey, queryClient, scope, settingsKey]);

  const updateField = React.useCallback(async (fieldPath: string, value: unknown) => {
    const currentSettings = bucketOptimisticScopeSettingsMap.get(bucketKey) ?? scopeSettings;
    await setSettings({
      ...currentSettings,
      [fieldPath]: value,
    });
  }, [bucketKey, scopeSettings, setSettings]);

  const resetField = React.useCallback(async (fieldPath: string) => {
    const current = { ...(bucketOptimisticScopeSettingsMap.get(bucketKey) ?? scopeSettings) };
    delete current[fieldPath];
    await setSettings(current);
  }, [bucketKey, scopeSettings, setSettings]);

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
  defaultValue?: TValue,
): PluginSettingsFieldState<TValue> => {
  const bucket = usePluginSettingsBucket(settingsKey);

  const rawValue = bucket.resolvedSettings[fieldPath];
  const value = (rawValue !== undefined ? rawValue : (defaultValue ?? null)) as TValue | null;
  const source = getSettingSource(bucket.settingsMeta, fieldPath);

  return {
    fieldPath,
    value,
    source,
    setValue: async (nextValue: TValue) => {
      const fallbackValue = getFieldFallbackValue(bucket, fieldPath, defaultValue);
      if (fallbackValue !== undefined && jsonDeepEqual(nextValue, fallbackValue)) {
        await bucket.resetField(fieldPath);
      } else {
        await bucket.updateField(fieldPath, nextValue);
      }
    },
    reset: async () => {
      await bucket.resetField(fieldPath);
    },
    bucket,
  };
};

function formatJsonValue(value: unknown): string {
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
}

function parseDateOrUndefined(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toIsoDate(value?: Date): string {
  return value ? format(value, "yyyy-MM-dd") : "";
}

export interface PluginSettingsFieldLabelRowProps {
  label: React.ReactNode;
  source?: SettingSource;
  onReset?: () => void;
}

export const PluginSettingsFieldLabelRow: React.FC<PluginSettingsFieldLabelRowProps> = ({ label, source, onReset }) => {
  const showModified = source?.is_overridden_in_scope === true;
  const resetLabel = source ? getSettingResetLabel(source) : undefined;
  const fromLayer = source && !source.is_overridden_in_scope && source.effective_layer !== 'default'
    ? getSettingLayerLabel(source.effective_layer)
    : undefined;

  // No source info at all — render label only, no placeholder chrome.
  if (!showModified && !fromLayer) {
    return <span>{label}</span>;
  }

  return (
    <span className="flex w-full items-center gap-2">
      <span className="flex-1">{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {showModified && (
          <span className="size-1.5 shrink-0 rounded-full bg-blue-500" />
        )}
        <span className="text-[10px] text-muted-foreground">
          {showModified ? "Modified" : `Inherited from ${fromLayer}`}
        </span>
        {showModified && (
          <button
            type="button"
            aria-label={resetLabel}
            title={resetLabel}
            onClick={(e) => { e.preventDefault(); void onReset?.(); }}
            className="inline-flex size-4 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-3" />
          </button>
        )}
      </span>
    </span>
  );
};

const PluginSettingsTextLikeField: React.FC<PluginSettingsBoundFieldBaseProps & {
  multiline?: boolean;
  defaultValue?: string;
}> = ({
  settingsKey,
  fieldPath,
  label,
  description,
  placeholder,
  multiline = false,
  defaultValue = "",
}) => {
  const field = usePluginSettingField<string>(settingsKey, fieldPath, defaultValue);
  const fieldId = useId();

  return (
    <Field className="group gap-2" data-modified={field.source.is_overridden_in_scope || undefined}>
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
  defaultValue = null,
}) => {
  const field = usePluginSettingField<number | null>(settingsKey, fieldPath, defaultValue);
  const fieldId = useId();

  return (
    <Field className="group gap-2" data-modified={field.source.is_overridden_in_scope || undefined}>
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
  defaultValue = false,
}) => {
  const field = usePluginSettingField<boolean>(settingsKey, fieldPath, defaultValue);
  const fieldId = useId();

  return (
    <Field orientation="responsive" className="group gap-3 py-1" data-modified={field.source.is_overridden_in_scope || undefined}>
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
  defaultValue = "",
}) => {
  const field = usePluginSettingField<string>(settingsKey, fieldPath, defaultValue);
  const fieldId = useId();

  return (
    <Field className="group gap-2" data-modified={field.source.is_overridden_in_scope || undefined}>
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
  defaultValue = "",
}) => {
  const field = usePluginSettingField<string>(settingsKey, fieldPath, defaultValue);
  const fieldId = useId();
  const selectedDate = parseDateOrUndefined(field.value);
  const dateLabel = selectedDate ? format(selectedDate, "PP") : placeholder || "Pick a date";

  return (
    <Field className="group gap-2" data-modified={field.source.is_overridden_in_scope || undefined}>
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
  defaultValue = null,
}) => {
  const field = usePluginSettingField(settingsKey, fieldPath, defaultValue);
  const fieldId = useId();
  const [jsonDraft, setJsonDraft] = useState(() => formatJsonValue(field.value));
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    setJsonDraft(formatJsonValue(field.value));
    setJsonError(null);
  }, [field.value]);

  return (
    <Field className="group gap-2" data-invalid={Boolean(jsonError) || undefined} data-modified={field.source.is_overridden_in_scope || undefined}>
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

export const PluginSettingsTimeField: React.FC<PluginSettingsTimeFieldProps> = ({
  settingsKey,
  fieldPath,
  label,
  description,
  defaultValue = 0,
  onCommit,
}) => {
  const field = usePluginSettingField<number>(settingsKey, fieldPath, defaultValue);
  const fieldId = useId();
  const currentMinutes = field.value ?? defaultValue;
  const [draft, setDraft] = useState(() => minutesToTimeString(currentMinutes));

  useEffect(() => {
    setDraft(minutesToTimeString(currentMinutes));
  }, [currentMinutes]);

  const handleCommit = useCallback((value: string) => {
    const parsed = parseTimeString(value);
    if (parsed === null) {
      setDraft(minutesToTimeString(currentMinutes));
      return;
    }
    if (onCommit) {
      void Promise.resolve(onCommit(parsed));
    } else {
      void field.setValue(parsed);
    }
  }, [currentMinutes, field, onCommit]);

  return (
    <Field className="group gap-2" data-modified={field.source.is_overridden_in_scope || undefined}>
      <FieldLabel htmlFor={fieldId}>
        <PluginSettingsFieldLabelRow label={label} source={field.source} onReset={field.reset} />
      </FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={fieldId}
          type="time"
          step={TIME_INPUT_STEP_SECONDS}
          value={draft}
          onChange={(event) => {
            const nextValue = event.target.value;
            setDraft(nextValue);
            if (parseTimeString(nextValue) !== null) {
              handleCommit(nextValue);
            }
          }}
          onBlur={(event) => handleCommit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            handleCommit(event.currentTarget.value);
            event.currentTarget.blur();
          }}
          className={TIME_INPUT_CLASS}
        />
        <InputGroupAddon align="inline-end" className="pr-2">
          <Clock3 className="size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
        </InputGroupAddon>
      </InputGroup>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
};

// ─── CRUD / custom panel helpers ──────────────────────────────────────────────

export interface PluginSettingsBucketSourceBannerProps {
  /** The bucket returned by `usePluginSettingsBucket`. */
  bucket: PluginSettingsBucketState;
  /**
   * The field path that represents the compound data managed by this panel
   * (e.g. `"rows"` for a CRUD table). Used to look up the source in `settingsMeta`.
   */
  fieldPath: string;
}

/**
 * Drop-in banner for CRUD / fully-custom plugin settings panels.
 *
 * Shows an "Inherited from X" notice when the panel data comes entirely from a
 * parent scope, and a "Modified here" notice with a reset action when it has
 * been overridden at the current scope.  Standard field components (`PluginSettingsTextField`,
 * etc.) handle this automatically; use this component only when your panel owns
 * the full rendering of a compound data field via `usePluginSettingsBucket`.
 *
 * @example
 * ```tsx
 * const bucket = usePluginSettingsBucket('events');
 * return (
 *   <>
 *     <PluginSettingsBucketSourceBanner bucket={bucket} fieldPath="rows" />
 *     <MyEventsTable data={bucket.resolvedSettings.rows} />
 *   </>
 * );
 * ```
 */
export const PluginSettingsBucketSourceBanner: React.FC<PluginSettingsBucketSourceBannerProps> = ({
  bucket,
  fieldPath,
}) => {
  const source = getSettingSource(bucket.settingsMeta, fieldPath);
  const resetLabel = getSettingResetLabel(source);

  if (source.effective_layer === 'default' && !source.is_overridden_in_scope) {
    return null;
  }

  return (
    <div className="mb-3 flex items-center gap-1.5">
      {source.is_overridden_in_scope && (
        <span className="size-2 shrink-0 rounded-full bg-blue-500" />
      )}
      <span className="flex-1 text-xs text-muted-foreground">
        {source.is_overridden_in_scope
          ? "Modified"
          : <>From <span className="font-medium">{getSettingLayerLabel(source.effective_layer)}</span></>}
      </span>
      {source.is_overridden_in_scope && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={resetLabel}
          title={resetLabel}
          onClick={() => void bucket.resetField(fieldPath)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw />
        </Button>
      )}
    </div>
  );
};
