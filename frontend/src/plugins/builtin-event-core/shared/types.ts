// input:  [schedule service DTOs, todo scheduling metadata, and shared calendar/tab state contracts]
// output: [event-core shared types for schedule snapshots, filters, calendar events, and settings]
// pos:    [type layer connecting timetable services with builtin-event-core tabs and widgets]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { CourseEvent, CourseEventType, CourseSection, ScheduleItem, WeekPattern } from '@/services/schedule';
import type { CalendarEventData, CalendarEventPatch, SemesterDateRange } from '@/calendar-core';

export type { CourseEvent, CourseEventType, CourseSection, ScheduleItem, WeekPattern };
export type { CalendarEventData, CalendarEventPatch, SemesterDateRange };

export type ScheduleDataMode = 'single-week' | 'all-weeks';

export interface ScheduleFilterState {
  showSkipped: boolean;
  courseFilter: string;
  typeFilter: string;
}

export interface ScheduleDataSnapshot {
  items: ScheduleItem[];
  itemsByWeek: Map<number, ScheduleItem[]>;
  maxWeek: number;
  loadedWeeks: number[];
  fetchedAt: number;
}

export interface TimetableScheduleChangePayload {
  source: 'course' | 'semester';
  reason:
    | 'course-updated'
    | 'event-type-created'
    | 'event-type-updated'
    | 'event-type-deleted'
    | 'section-created'
    | 'section-updated'
    | 'section-deleted'
    | 'event-updated'
    | 'events-updated';
  courseId?: string;
  semesterId?: string;
}

export interface TimetableEventPayloadMap {
  'timetable:schedule-data-changed': TimetableScheduleChangePayload;
}

export type TimetableEventType = keyof TimetableEventPayloadMap;

export type PublishEventOptions = {
  debounceMs?: number;
  dedupeWindowMs?: number;
  dedupeKey?: string;
};

export type WeekPatternOption = WeekPattern;

export type CalendarViewMode = 'week' | 'month';

export interface CalendarSettingsState {
  eventColors: Record<string, string>;
  highlightConflicts: boolean;
  showWeekends: boolean;
  countReadingWeekInWeekNumber: boolean;
  dayStartMinutes: number;
  dayEndMinutes: number;
}
