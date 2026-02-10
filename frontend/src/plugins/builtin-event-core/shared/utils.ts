import type { CourseEvent, ScheduleItem } from '@/services/schedule';
import {
  ALL_FILTER_VALUE,
  CALENDAR_EVENT_DEFAULT_COLORS,
  DAY_OF_WEEK_OPTIONS,
  SLOT_LOCATION_NOTE_PREFIX,
} from './constants';
import type {
  CalendarEventData,
  CalendarEventPatch,
  CalendarEventColorConfig,
  ScheduleFilterState,
  SemesterDateRange,
  SkippedDisplayMode,
} from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const asChecked = (value: boolean | 'indeterminate') => value === true;

export const toMinutes = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return (hour * 60) + minute;
};

export const formatHour = (minutes: number) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

export const getDayLabel = (value: number) => DAY_OF_WEEK_OPTIONS.find((item) => item.value === value)?.label ?? String(value);

export const extractLocationFromNote = (note?: string | null) => {
  if (!note || !note.startsWith(SLOT_LOCATION_NOTE_PREFIX)) return null;
  const firstLine = note.slice(SLOT_LOCATION_NOTE_PREFIX.length).split('\n')[0];
  return firstLine.trim() || null;
};

export const buildScheduleItemKey = (item: ScheduleItem) =>
  `${item.eventId}:${item.week}:${item.dayOfWeek}:${item.startTime}:${item.endTime}`;

export const dedupeScheduleItems = (items: ScheduleItem[]) => {
  const seen = new Set<string>();
  const result: ScheduleItem[] = [];

  for (const item of items) {
    const key = buildScheduleItemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
};

export const sortScheduleItemsByTime = (items: ScheduleItem[]) => {
  return [...items].sort((a, b) => {
    return (
      a.week - b.week ||
      a.dayOfWeek - b.dayOfWeek ||
      toMinutes(a.startTime) - toMinutes(b.startTime) ||
      toMinutes(a.endTime) - toMinutes(b.endTime)
    );
  });
};

export const mapScheduleItemsByWeek = (items: ScheduleItem[]) => {
  const map = new Map<number, ScheduleItem[]>();

  for (const item of items) {
    const weekItems = map.get(item.week) ?? [];
    weekItems.push(item);
    map.set(item.week, weekItems);
  }

  for (const [week, weekItems] of map.entries()) {
    map.set(week, sortScheduleItemsByTime(weekItems));
  }

  return map;
};

export const filterScheduleItems = (items: ScheduleItem[], filters: ScheduleFilterState) => {
  return items.filter((item) => {
    if (!filters.showSkipped && item.skip) return false;
    if (filters.courseFilter !== ALL_FILTER_VALUE && item.courseId !== filters.courseFilter) return false;
    if (filters.typeFilter !== ALL_FILTER_VALUE && item.eventTypeCode !== filters.typeFilter) return false;
    return true;
  });
};

export const buildCourseOptions = (items: ScheduleItem[]) => {
  const map = new Map<string, string>();
  for (const item of items) {
    map.set(item.courseId, item.courseName);
  }
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
};

export const buildTypeOptions = (items: ScheduleItem[]) => {
  return Array.from(new Set(items.map((item) => item.eventTypeCode))).sort((a, b) => a.localeCompare(b));
};

export const groupCourseEventsBySection = (events: CourseEvent[]) => {
  const map = new Map<string, CourseEvent[]>();

  for (const event of events) {
    if (!event.sectionId) continue;
    const sectionEvents = map.get(event.sectionId) ?? [];
    sectionEvents.push(event);
    map.set(event.sectionId, sectionEvents);
  }

  for (const [sectionId, sectionEvents] of map.entries()) {
    map.set(
      sectionId,
      [...sectionEvents].sort((a, b) => a.dayOfWeek - b.dayOfWeek || toMinutes(a.startTime) - toMinutes(b.startTime))
    );
  }

  return map;
};

const parseDateLike = (value?: string | Date | null) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    return new Date(value);
  }

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed;
};

const startOfDay = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

export const startOfWeekMonday = (date: Date) => {
  const normalized = startOfDay(date);
  const day = normalized.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return new Date(normalized.getTime() + (offset * DAY_MS));
};

export const addDays = (date: Date, days: number) => {
  return new Date(date.getTime() + (days * DAY_MS));
};

export const parseTimeOnDate = (date: Date, time: string) => {
  const minutes = toMinutes(time);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Math.max(0, Math.min(23, hour)),
    Math.max(0, Math.min(59, minute)),
    0,
    0,
  );
};

export const resolveSemesterDateRange = (
  startDateLike?: string | Date | null,
  endDateLike?: string | Date | null,
  maxWeek = 16,
): SemesterDateRange => {
  const parsedStart = parseDateLike(startDateLike) ?? new Date();
  const startDate = startOfWeekMonday(parsedStart);
  const parsedEnd = parseDateLike(endDateLike);

  const fallbackEndDate = addDays(startDate, (Math.max(1, Math.floor(maxWeek)) * 7) - 1);
  const endDate = parsedEnd && parsedEnd.getTime() >= startDate.getTime()
    ? startOfDay(parsedEnd)
    : fallbackEndDate;

  return { startDate, endDate };
};

export const getDateForScheduleItem = (semesterStartDate: Date, week: number, dayOfWeek: number) => {
  const offsetDays = (Math.max(1, week) - 1) * 7 + (Math.max(1, dayOfWeek) - 1);
  return addDays(startOfWeekMonday(semesterStartDate), offsetDays);
};

export const toCalendarEvent = (
  item: ScheduleItem,
  semesterStartDate: Date,
  eventColors: CalendarEventColorConfig = CALENDAR_EVENT_DEFAULT_COLORS,
  skippedDisplayMode: SkippedDisplayMode = 'grayed',
): CalendarEventData | null => {
  if (item.skip && skippedDisplayMode === 'hidden') {
    return null;
  }

  const targetDate = getDateForScheduleItem(semesterStartDate, item.week, item.dayOfWeek);
  const start = parseTimeOnDate(targetDate, item.startTime);
  let end = parseTimeOnDate(targetDate, item.endTime);

  if (end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + (30 * 60 * 1000));
  }

  return {
    id: `${item.eventId}:${item.week}`,
    eventId: item.eventId,
    source: 'schedule',
    title: item.title?.trim() || `${item.courseName} · ${item.eventTypeCode}`,
    courseId: item.courseId,
    courseName: item.courseName,
    eventTypeCode: item.eventTypeCode,
    start,
    end,
    week: item.week,
    dayOfWeek: item.dayOfWeek,
    startTime: item.startTime,
    endTime: item.endTime,
    color: eventColors.schedule,
    isSkipped: item.skip,
    isConflict: item.isConflict,
    conflictGroupId: item.conflictGroupId,
    enable: item.enable,
    note: item.note,
  };
};

export const sortCalendarEvents = (events: CalendarEventData[]) => {
  return [...events].sort((a, b) => {
    return a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime() || a.title.localeCompare(b.title);
  });
};

export const buildCalendarEvents = (
  items: ScheduleItem[],
  semesterStartDate: Date,
  eventColors: CalendarEventColorConfig,
  skippedDisplayMode: SkippedDisplayMode,
) => {
  const events: CalendarEventData[] = [];

  for (const item of items) {
    const event = toCalendarEvent(item, semesterStartDate, eventColors, skippedDisplayMode);
    if (!event) continue;

    events.push(event);
  }

  return sortCalendarEvents(events);
};

export const patchCalendarEvents = (events: CalendarEventData[], eventId: string, patch: CalendarEventPatch) => {
  return events.map((event) => {
    if (event.eventId !== eventId) return event;
    return {
      ...event,
      isSkipped: typeof patch.skip === 'boolean' ? patch.skip : event.isSkipped,
      enable: typeof patch.enable === 'boolean' ? patch.enable : event.enable,
    };
  });
};
