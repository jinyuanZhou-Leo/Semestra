// input:  [calendar defaults, stored settings payloads, raw time/minute values, and registered source metadata]
// output: [calendar-settings normalization helpers, per-source visibility/color defaults, LMS description safety defaults, time parsing/formatting helpers, and defaults]
// pos:    [calendar settings utility layer shared by settings UIs, tab runtime, and export flows]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import {
  CALENDAR_DEFAULT_END_MINUTES,
  CALENDAR_DEFAULT_START_MINUTES,
  BUILTIN_CALENDAR_SOURCE_SCHEDULE,
} from '../../shared/constants';
import type { CalendarSettingsState } from '../../shared/types';
import { getRegisteredCalendarSources } from '@/calendar-core';
import { ensureBuiltinCalendarSourcesRegistered } from './sources/registerBuiltinCalendarSources';

const DAY_MINUTES = 24 * 60;
const MIN_WINDOW_MINUTES = 60;
export const CALENDAR_TIME_INPUT_STEP_SECONDS = 60;
export const CALENDAR_MIN_WEEK_VIEW_DAY_COUNT = 1;
export const CALENDAR_MAX_WEEK_VIEW_DAY_COUNT = 7;

ensureBuiltinCalendarSourcesRegistered();

const clampMinute = (value: number) => Math.max(0, Math.min(DAY_MINUTES - 1, Math.floor(value)));

const parseMinuteValue = (value: unknown, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clampMinute(value);
};

const normalizeWeekViewDayCount = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 5;
  return Math.max(
    CALENDAR_MIN_WEEK_VIEW_DAY_COUNT,
    Math.min(CALENDAR_MAX_WEEK_VIEW_DAY_COUNT, Math.floor(value)),
  );
};

export const normalizeDayMinuteWindow = (start: number, end: number) => {
  let normalizedStart = clampMinute(start);
  let normalizedEnd = clampMinute(end);

  if (normalizedEnd <= normalizedStart) {
    normalizedEnd = Math.min(DAY_MINUTES - 1, normalizedStart + MIN_WINDOW_MINUTES);
  }

  if (normalizedEnd - normalizedStart < MIN_WINDOW_MINUTES) {
    normalizedStart = Math.max(0, normalizedEnd - MIN_WINDOW_MINUTES);
  }

  return { dayStartMinutes: normalizedStart, dayEndMinutes: normalizedEnd };
};

export const toTimeInputValue = (minutes: number) => {
  const safeMinutes = clampMinute(minutes);
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

export const parseTimeInputValue = (value: string): number | null => {
  const matched = /^(\d{2}):(\d{2})$/.exec(value);
  if (!matched) return null;
  const hour = Number(matched[1]);
  const minute = Number(matched[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return clampMinute((hour * 60) + minute);
};

export const buildDefaultCalendarEventColors = () => {
  return getRegisteredCalendarSources().reduce<Record<string, string>>((colors, source) => {
    colors[source.id] = source.defaultColor;
    return colors;
  }, {});
};

export const buildDefaultCalendarSourceVisibility = () => {
  return getRegisteredCalendarSources().reduce<Record<string, boolean>>((visibility, source) => {
    visibility[source.id] = true;
    return visibility;
  }, {});
};

export const getCalendarEventColor = (eventColors: Record<string, string>, sourceId: string) => {
  return eventColors[sourceId] ?? buildDefaultCalendarEventColors()[sourceId] ?? '#3b82f6';
};

export const DEFAULT_CALENDAR_SETTINGS: CalendarSettingsState = {
  eventColors: buildDefaultCalendarEventColors(),
  sourceVisibility: buildDefaultCalendarSourceVisibility(),
  highlightConflicts: true,
  showWeekends: true,
  countReadingWeekInWeekNumber: false,
  renderUnsafeLmsDescriptionHtml: false,
  weekViewDayCount: 5,
  dayStartMinutes: CALENDAR_DEFAULT_START_MINUTES,
  dayEndMinutes: CALENDAR_DEFAULT_END_MINUTES,
};

export const normalizeCalendarSettings = (value: unknown): CalendarSettingsState => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const providedColors = source.eventColors && typeof source.eventColors === 'object'
    ? (source.eventColors as Record<string, unknown>)
    : {};
  const defaultEventColors = buildDefaultCalendarEventColors();
  const defaultSourceVisibility = buildDefaultCalendarSourceVisibility();
  const normalizedProvidedColors = Object.fromEntries(
    Object.entries(providedColors).filter((entry) => typeof entry[1] === 'string'),
  ) as Record<string, string>;
  const eventColors: Record<string, string> = {
    ...defaultEventColors,
    ...normalizedProvidedColors,
  };
  const providedSourceVisibility = source.sourceVisibility && typeof source.sourceVisibility === 'object'
    ? (source.sourceVisibility as Record<string, unknown>)
    : {};
  const normalizedProvidedSourceVisibility = Object.fromEntries(
    Object.entries(providedSourceVisibility).filter((entry) => typeof entry[1] === 'boolean'),
  ) as Record<string, boolean>;
  const sourceVisibility: Record<string, boolean> = {
    ...defaultSourceVisibility,
    ...normalizedProvidedSourceVisibility,
  };

  const { dayStartMinutes, dayEndMinutes } = normalizeDayMinuteWindow(
    parseMinuteValue(source.dayStartMinutes, CALENDAR_DEFAULT_START_MINUTES),
    parseMinuteValue(source.dayEndMinutes, CALENDAR_DEFAULT_END_MINUTES),
  );

  return {
    eventColors,
    sourceVisibility,
    highlightConflicts: typeof source.highlightConflicts === 'boolean' ? source.highlightConflicts : true,
    showWeekends: typeof source.showWeekends === 'boolean' ? source.showWeekends : true,
    countReadingWeekInWeekNumber: typeof source.countReadingWeekInWeekNumber === 'boolean'
      ? source.countReadingWeekInWeekNumber
      : false,
    renderUnsafeLmsDescriptionHtml: typeof source.renderUnsafeLmsDescriptionHtml === 'boolean'
      ? source.renderUnsafeLmsDescriptionHtml
      : false,
    weekViewDayCount: normalizeWeekViewDayCount(source.weekViewDayCount),
    dayStartMinutes,
    dayEndMinutes,
  };
};

export const getScheduleEventColor = (settings: CalendarSettingsState) => {
  return getCalendarEventColor(settings.eventColors, BUILTIN_CALENDAR_SOURCE_SCHEDULE);
};
