// input:  [schedule service entities, shared calendar constants, todo scheduling data, and semester date ranges]
// output: [date/time helpers, schedule grouping utilities, and event-core calendar mappers]
// pos:    [shared event-core utility layer for transforming backend schedule data into tab-ready state with Reading Week support]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { CourseEvent, ScheduleItem } from '@/services/schedule';
import type { CalendarEventData, CalendarEventPatch, SemesterDateRange } from '@/calendar-core';
import {
  ALL_FILTER_VALUE,
  BUILTIN_CALENDAR_SOURCE_SCHEDULE,
  DAY_OF_WEEK_OPTIONS,
  SLOT_LOCATION_NOTE_PREFIX,
} from './constants';
import type { ScheduleFilterState } from './types';

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

  const trimmed = value.trim();
  const localDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (localDateMatch) {
    const year = Number(localDateMatch[1]);
    const month = Number(localDateMatch[2]);
    const day = Number(localDateMatch[3]);
    const parsedLocalDate = new Date(year, month - 1, day);
    if (!Number.isFinite(parsedLocalDate.getTime())) return null;
    return parsedLocalDate;
  }

  const parsed = new Date(trimmed);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed;
};

const startOfDay = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
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

export const getNextVisibleDate = (date: Date, showWeekends: boolean) => {
  let cursor = startOfDay(date);
  while (!showWeekends && isWeekend(cursor)) {
    cursor = addDays(cursor, 1);
  }
  return cursor;
};

export const getPreviousVisibleDate = (date: Date, showWeekends: boolean) => {
  let cursor = startOfDay(date);
  while (!showWeekends && isWeekend(cursor)) {
    cursor = addDays(cursor, -1);
  }
  return cursor;
};

export const getCalendarVisibleRangeEnd = (startDate: Date, visibleDayCount: number, showWeekends: boolean) => {
  const safeVisibleDayCount = Math.max(1, Math.floor(visibleDayCount));
  let cursor = getNextVisibleDate(startDate, showWeekends);
  let remainingVisibleDays = safeVisibleDayCount;

  while (remainingVisibleDays > 0) {
    if (showWeekends || !isWeekend(cursor)) {
      remainingVisibleDays -= 1;
    }
    cursor = addDays(cursor, 1);
  }

  return cursor;
};

export const shiftCalendarVisibleStartDate = (startDate: Date, visibleDayDelta: number, showWeekends: boolean) => {
  if (visibleDayDelta === 0) {
    return getNextVisibleDate(startDate, showWeekends);
  }

  const direction = Math.sign(visibleDayDelta);
  let remainingVisibleDays = Math.abs(Math.floor(visibleDayDelta));
  let cursor = getNextVisibleDate(startDate, showWeekends);

  while (remainingVisibleDays > 0) {
    cursor = addDays(cursor, direction);
    if (showWeekends || !isWeekend(cursor)) {
      remainingVisibleDays -= 1;
    }
  }

  return cursor;
};

export const getVisiblePageStartForDate = (date: Date, visibleDayCount: number, showWeekends: boolean) => {
  const safeVisibleDayCount = Math.max(1, Math.floor(visibleDayCount));
  const normalizedDate = startOfDay(date);
  const weekStart = startOfWeekMonday(normalizedDate);
  let cursor = weekStart;
  let currentPageStart = getNextVisibleDate(weekStart, showWeekends);
  let visibleDayIndex = 0;

  while (cursor.getTime() < normalizedDate.getTime()) {
    if (showWeekends || !isWeekend(cursor)) {
      if (visibleDayIndex > 0 && visibleDayIndex % safeVisibleDayCount === 0) {
        currentPageStart = cursor;
      }
      visibleDayIndex += 1;
    }
    cursor = addDays(cursor, 1);
  }

  if (!showWeekends && isWeekend(normalizedDate)) {
    return currentPageStart;
  }

  if ((showWeekends || !isWeekend(normalizedDate)) && visibleDayIndex > 0 && visibleDayIndex % safeVisibleDayCount === 0) {
    return normalizedDate;
  }

  return currentPageStart;
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
  readingWeekStartLike?: string | Date | null,
  readingWeekEndLike?: string | Date | null,
): SemesterDateRange => {
  const parsedStart = parseDateLike(startDateLike) ?? new Date();
  const startDate = startOfWeekMonday(parsedStart);
  const parsedEnd = parseDateLike(endDateLike);

  const fallbackEndDate = addDays(startDate, (Math.max(1, Math.floor(maxWeek)) * 7) - 1);
  const endDate = parsedEnd && parsedEnd.getTime() >= startDate.getTime()
    ? startOfDay(parsedEnd)
    : fallbackEndDate;

  const parsedReadingWeekStart = parseDateLike(readingWeekStartLike);
  const parsedReadingWeekEnd = parseDateLike(readingWeekEndLike);
  const normalizedReadingWeekStart = parsedReadingWeekStart ? startOfDay(parsedReadingWeekStart) : null;
  const normalizedReadingWeekEnd = parsedReadingWeekEnd ? startOfDay(parsedReadingWeekEnd) : null;
  const isReadingWeekValid = Boolean(
    normalizedReadingWeekStart
    && normalizedReadingWeekEnd
    && normalizedReadingWeekStart.getDay() === 1
    && normalizedReadingWeekEnd.getDay() === 0
    && (normalizedReadingWeekEnd.getTime() - normalizedReadingWeekStart.getTime()) === (6 * DAY_MS)
    && normalizedReadingWeekStart.getTime() >= startDate.getTime()
    && normalizedReadingWeekEnd.getTime() <= endDate.getTime()
  );

  return {
    startDate,
    endDate,
    readingWeekStart: isReadingWeekValid ? normalizedReadingWeekStart : null,
    readingWeekEnd: isReadingWeekValid ? normalizedReadingWeekEnd : null,
  };
};

export const getDateForScheduleItem = (semesterStartDate: Date, week: number, dayOfWeek: number) => {
  const offsetDays = (Math.max(1, week) - 1) * 7 + (Math.max(1, dayOfWeek) - 1);
  return addDays(startOfWeekMonday(semesterStartDate), offsetDays);
};

export const getWeekStartForSemester = (semesterStartDate: Date, week: number) => {
  return addDays(startOfWeekMonday(semesterStartDate), (Math.max(1, week) - 1) * 7);
};

export const getWeekFromSemesterDate = (semesterStartDate: Date, date: Date) => {
  const semesterStart = startOfWeekMonday(semesterStartDate).getTime();
  const targetStart = startOfWeekMonday(date).getTime();
  return Math.floor((targetStart - semesterStart) / DAY_MS / 7) + 1;
};

export const getReadingWeekIndex = (semesterRange: SemesterDateRange) => {
  if (!semesterRange.readingWeekStart || !semesterRange.readingWeekEnd) return null;
  return getWeekFromSemesterDate(semesterRange.startDate, semesterRange.readingWeekStart);
};

export const isReadingWeek = (semesterRange: SemesterDateRange, week: number) => {
  const readingWeekIndex = getReadingWeekIndex(semesterRange);
  if (readingWeekIndex === null) return false;
  return Math.max(1, week) === readingWeekIndex;
};

export const isDateInReadingWeek = (date: Date, semesterRange: SemesterDateRange) => {
  if (!semesterRange.readingWeekStart || !semesterRange.readingWeekEnd) return false;
  const targetTime = startOfDay(date).getTime();
  return targetTime >= semesterRange.readingWeekStart.getTime() && targetTime <= semesterRange.readingWeekEnd.getTime();
};

export const getDisplayWeekNumber = (
  semesterRange: SemesterDateRange,
  week: number,
  countReadingWeekInWeekNumber: boolean,
) => {
  const safeWeek = Math.max(1, week);
  const readingWeekIndex = getReadingWeekIndex(semesterRange);
  if (readingWeekIndex === null || countReadingWeekInWeekNumber) return safeWeek;
  if (safeWeek === readingWeekIndex) return null;
  return safeWeek > readingWeekIndex ? safeWeek - 1 : safeWeek;
};

export const getDisplayMaxWeek = (
  semesterRange: SemesterDateRange,
  maxWeek: number,
  countReadingWeekInWeekNumber: boolean,
) => {
  const safeMaxWeek = Math.max(1, maxWeek);
  const readingWeekIndex = getReadingWeekIndex(semesterRange);
  if (readingWeekIndex === null || countReadingWeekInWeekNumber) return safeMaxWeek;
  return Math.max(1, safeMaxWeek - 1);
};

export const toCalendarEvent = (
  item: ScheduleItem,
  semesterStartDate: Date,
): CalendarEventData | null => {
  const targetDate = getDateForScheduleItem(semesterStartDate, item.week, item.dayOfWeek);
  const start = parseTimeOnDate(targetDate, item.startTime);
  let end = parseTimeOnDate(targetDate, item.endTime);

  if (end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + (30 * 60 * 1000));
  }

  return {
    id: `${item.eventId}:${item.week}`,
    eventId: item.eventId,
    sourceId: BUILTIN_CALENDAR_SOURCE_SCHEDULE,
    title: item.title?.trim() || `${item.courseName} · ${item.eventTypeCode}`,
    courseId: item.courseId,
    courseName: item.courseName,
    eventTypeCode: item.eventTypeCode,
    start,
    end,
    allDay: false,
    week: item.week,
    dayOfWeek: item.dayOfWeek,
    weekPattern: item.weekPattern,
    isRecurring: Boolean(item.weekPattern),
    startTime: item.startTime,
    endTime: item.endTime,
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
) => {
  const events: CalendarEventData[] = [];

  for (const item of items) {
    const event = toCalendarEvent(item, semesterStartDate);
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
