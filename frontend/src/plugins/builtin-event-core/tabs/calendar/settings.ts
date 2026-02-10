import {
  CALENDAR_DEFAULT_END_MINUTES,
  CALENDAR_DEFAULT_START_MINUTES,
  CALENDAR_EVENT_DEFAULT_COLORS,
} from '../../shared/constants';
import type { CalendarSettingsState } from '../../shared/types';

const DAY_MINUTES = 24 * 60;
const MIN_WINDOW_MINUTES = 60;

const clampMinute = (value: number) => Math.max(0, Math.min(DAY_MINUTES - 1, Math.floor(value)));

const parseMinuteValue = (value: unknown, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clampMinute(value);
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

export const DEFAULT_CALENDAR_SETTINGS: CalendarSettingsState = {
  eventColors: {
    schedule: CALENDAR_EVENT_DEFAULT_COLORS.schedule,
    todo: CALENDAR_EVENT_DEFAULT_COLORS.todo,
    custom: CALENDAR_EVENT_DEFAULT_COLORS.custom,
  },
  highlightConflicts: true,
  showWeekends: true,
  dayStartMinutes: CALENDAR_DEFAULT_START_MINUTES,
  dayEndMinutes: CALENDAR_DEFAULT_END_MINUTES,
};

export const normalizeCalendarSettings = (value: unknown): CalendarSettingsState => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const sourceColors = source.eventColors && typeof source.eventColors === 'object'
    ? (source.eventColors as Record<string, unknown>)
    : {};

  const { dayStartMinutes, dayEndMinutes } = normalizeDayMinuteWindow(
    parseMinuteValue(source.dayStartMinutes, CALENDAR_DEFAULT_START_MINUTES),
    parseMinuteValue(source.dayEndMinutes, CALENDAR_DEFAULT_END_MINUTES),
  );

  return {
    eventColors: {
      schedule: typeof sourceColors.schedule === 'string' ? sourceColors.schedule : CALENDAR_EVENT_DEFAULT_COLORS.schedule,
      todo: typeof sourceColors.todo === 'string' ? sourceColors.todo : CALENDAR_EVENT_DEFAULT_COLORS.todo,
      custom: typeof sourceColors.custom === 'string' ? sourceColors.custom : CALENDAR_EVENT_DEFAULT_COLORS.custom,
    },
    highlightConflicts: typeof source.highlightConflicts === 'boolean' ? source.highlightConflicts : true,
    showWeekends: typeof source.showWeekends === 'boolean' ? source.showWeekends : true,
    dayStartMinutes,
    dayEndMinutes,
  };
};
