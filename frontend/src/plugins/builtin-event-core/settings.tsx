// input:  [event-core tab settings sections, public plugin-system settings contracts, calendar/todo/event-type helpers, and shared constants]
// output: [calendar, todo, and event-type plugin settings sections for semester/course/program scopes via definePluginSettings]
// pos:    [settings entry that centralizes builtin-event-core tab settings UI and exposes them through the plugin settings inheritance chain]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useMemo } from 'react';

import {
  definePluginSettings,
  PluginSettingsBooleanField,
  PluginSettingsBucketSourceBanner,
  usePluginSettingsBucket,
  type PluginSettingsSectionProps,
} from '@/plugin-sdk';
import { jsonDeepEqual } from '@/plugin-system/utils';
import { SettingsSection } from '@/components/SettingsSection';
import { FieldGroup, FieldSet } from '@/components/ui/field';
import type { CourseEventType } from '@/services/schedule';

import { CalendarSettingsSection } from './tabs/calendar/CalendarSettingsSection';
import { CourseScheduleSettings } from './tabs/course-schedule';
import { EventTypesDataTable, type EventTypeFormData } from './tabs/course-schedule/EventTypesDataTable';
import {
  BUILTIN_TIMETABLE_TODO_TAB_TYPE,
  BUILTIN_EVENT_CORE_SETTINGS_KEY,
  EVENT_CORE_EVENT_TYPES_FIELD,
} from './shared/constants';

// ── Event type normalization helpers (semester/program scope) ─────────────────

const DEFAULT_EVENT_TYPES: CourseEventType[] = [
  { id: 'builtin-lecture', code: 'LECTURE', abbreviation: 'LEC', track_attendance: false, color: null, icon: null },
  { id: 'builtin-practical', code: 'PRACTICAL', abbreviation: 'PRA', track_attendance: false, color: null, icon: null },
  { id: 'builtin-tutorial', code: 'TUTORIAL', abbreviation: 'TUT', track_attendance: false, color: null, icon: null },
];

function normalizeEventTypes(value: unknown): CourseEventType[] {
  if (!Array.isArray(value)) {
    return DEFAULT_EVENT_TYPES;
  }
  const normalized = value.flatMap((item, index) => {
    if (typeof item !== 'object' || item === null) return [];
    const record = item as Record<string, unknown>;
    const code = typeof record.code === 'string' ? record.code.trim().toUpperCase() : '';
    const abbreviation = typeof record.abbreviation === 'string' ? record.abbreviation.trim().toUpperCase() : '';
    if (!code || !abbreviation) return [];
    return [{
      id: typeof record.id === 'string' ? record.id : `${code}-${index}`,
      code,
      abbreviation,
      track_attendance: Boolean(record.track_attendance),
      color: typeof record.color === 'string' ? record.color : null,
      icon: typeof record.icon === 'string' ? record.icon : null,
    }];
  });
  return normalized.length > 0 ? normalized : DEFAULT_EVENT_TYPES;
}

function serializeEventTypes(items: CourseEventType[]): Array<Record<string, unknown>> {
  return items.map((item) => ({
    id: item.id,
    code: item.code,
    abbreviation: item.abbreviation,
    track_attendance: item.track_attendance,
    color: item.color ?? null,
    icon: item.icon ?? null,
  }));
}

function buildCreatedEventType(data: EventTypeFormData): CourseEventType {
  const code = data.code.trim().toUpperCase();
  return {
    id: code,
    code,
    abbreviation: data.abbreviation.trim().toUpperCase(),
    track_attendance: data.track_attendance,
    color: null,
    icon: null,
  };
}

function getEventTypesFallback(bucket: { inheritedSettings: Record<string, unknown> }): Array<Record<string, unknown>> {
  const inheritedValue = bucket.inheritedSettings[EVENT_CORE_EVENT_TYPES_FIELD];
  if (inheritedValue === undefined) {
    return serializeEventTypes(DEFAULT_EVENT_TYPES);
  }
  return serializeEventTypes(normalizeEventTypes(inheritedValue));
}

// ── Calendar settings section (semester only) ─────────────────────────────────

const SemesterCalendarSettingsSection: React.FC<PluginSettingsSectionProps> = ({ scope }) => {
  const semesterId = scope.kind === 'semester' ? scope.semesterId : undefined;
  // CalendarSettingsSection is self-contained: it reads and writes via usePluginSettingsBucket
  // directly. No adapter layer is needed here.
  return <CalendarSettingsSection semesterId={semesterId} />;
};

// ── Todo defaults settings section (program/semester/course) ──────────────────

const TodoDefaultsSettingsSection: React.FC<PluginSettingsSectionProps> = () => {
  return (
    <SettingsSection title="Todo" description="Task completion behavior defaults.">
      <FieldSet>
        <FieldGroup>
          <PluginSettingsBooleanField
            settingsKey={BUILTIN_TIMETABLE_TODO_TAB_TYPE}
            fieldPath="moveCompletedToCompletedSection"
            label="Store completed tasks in the hidden completed bucket"
            description="When disabled, completed tasks stay attached to their original section records."
          />
        </FieldGroup>
      </FieldSet>
    </SettingsSection>
  );
};

// ── Event types settings section (semester/course scope via plugin bucket) ─────

const SEMESTER_EVENT_TYPES_DESCRIPTION = 'Manage the event types available for course schedules, including their labels and attendance tracking.';

const SemesterEventTypesSettingsSection: React.FC<PluginSettingsSectionProps> = ({ scope }) => {
  const bucket = usePluginSettingsBucket(BUILTIN_EVENT_CORE_SETTINGS_KEY);
  const eventTypes = useMemo(
    () => normalizeEventTypes(bucket.resolvedSettings[EVENT_CORE_EVENT_TYPES_FIELD]),
    [bucket.resolvedSettings],
  );

  const { updateField, resetField, inheritedSettings } = bucket;
  const saveEventTypes = React.useCallback(async (next: CourseEventType[]) => {
    const serializedNext = serializeEventTypes(next);
    const fallbackEventTypes = getEventTypesFallback({ inheritedSettings });

    if (jsonDeepEqual(serializedNext, fallbackEventTypes)) {
      await resetField(EVENT_CORE_EVENT_TYPES_FIELD);
    } else {
      await updateField(EVENT_CORE_EVENT_TYPES_FIELD, serializedNext);
    }
  }, [updateField, resetField, inheritedSettings]);

  const handleCreateOrUpdate = React.useCallback(async (
    data: EventTypeFormData,
    editingType: CourseEventType | null,
  ) => {
    const next = editingType
      ? eventTypes.map((item) => item.id === editingType.id ? { ...item, ...data } : item)
      : [...eventTypes, buildCreatedEventType(data)];
    await saveEventTypes(next);
  }, [eventTypes, saveEventTypes]);

  const handleDelete = React.useCallback(async (code: string) => {
    await saveEventTypes(eventTypes.filter((item) => item.code !== code));
  }, [eventTypes, saveEventTypes]);

  // For course scope, delegate to CourseScheduleSettings which uses scheduleService
  if (scope.kind === 'course') {
    return <CourseScheduleSettings courseId={scope.courseId} />;
  }

  return (
    <SettingsSection title="Course Schedule" description={SEMESTER_EVENT_TYPES_DESCRIPTION}>
      <PluginSettingsBucketSourceBanner bucket={bucket} fieldPath={EVENT_CORE_EVENT_TYPES_FIELD} />
      <EventTypesDataTable
        eventTypes={eventTypes}
        isLoading={bucket.isLoading}
        onCreateOrUpdate={handleCreateOrUpdate}
        onDelete={handleDelete}
      />
    </SettingsSection>
  );
};

export default definePluginSettings({
  pluginSettings: [
    {
      id: 'semester-calendar',
      component: SemesterCalendarSettingsSection,
      allowedContexts: ['semester'],
    },
    {
      id: 'todo-defaults',
      component: TodoDefaultsSettingsSection,
      allowedContexts: ['program', 'semester', 'course'],
    },
    {
      id: 'semester-event-types',
      component: SemesterEventTypesSettingsSection,
      allowedContexts: ['semester', 'course'],
    },
  ],
});
