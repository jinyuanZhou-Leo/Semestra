// input:  [schedule service DTOs, todo scheduling metadata, todo list storage contracts, calendar-core base types, and shared calendar/tab state contracts]
// output: [event-core shared types for schedule snapshots, filters, timetable calendar events, settings, and timetable/todo data-change payloads]
// pos:    [type layer connecting timetable services with builtin-event-core tabs, widgets, todo sync, and external Calendar sources]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { CourseEvent, CourseEventType, CourseSection, ScheduleItem, WeekPattern } from '@/services/schedule';
import type { CalendarEventBase, CalendarEventPatch, CalendarScopeRange } from '../calendar-core';
import type { TodoListSource } from '../tabs/todo/types';

export type { CourseEvent, CourseEventType, CourseSection, ScheduleItem, WeekPattern };
export type { CalendarEventBase, CalendarEventPatch };

export interface TimetableCalendarEvent extends CalendarEventBase {
  eventId: string;
  courseId: string;
  courseName: string;
  eventTypeCode: string;
  week: number;
  dayOfWeek: number;
  weekPattern?: string | null;
  isRecurring: boolean;
  startTime: string;
  endTime: string;
  isSkipped: boolean;
  isConflict: boolean;
  conflictGroupId?: string | null;
  enable: boolean;
  todoState?: {
    completed: boolean;
    listSource: 'course' | 'semester';
    listId: string;
  };
}

// Backward compatibility alias
export type CalendarEventData = TimetableCalendarEvent;

export interface TimetableSemesterRange extends CalendarScopeRange {
  readingWeekStart: Date | null;
  readingWeekEnd: Date | null;
}

// Backward compatibility alias
export type SemesterDateRange = TimetableSemesterRange;

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
  reason: string;
  courseId?: string;
  semesterId?: string;
  signalId?: string;
}

export interface TimetableEventPayloadMap {
  'timetable:schedule-data-changed': TimetableScheduleChangePayload;
  'timetable:todo-data-changed': {
    semesterId: string;
    source: TodoListSource;
    listId: string;
    courseId?: string;
    updatedAt: string;
  };
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
  sourceVisibility: Record<string, boolean>;
  highlightConflicts: boolean;
  showWeekends: boolean;
  countReadingWeekInWeekNumber: boolean;
  renderUnsafeLmsDescriptionHtml: boolean;
  weekViewDayCount: number;
  dayStartMinutes: number;
  dayEndMinutes: number;
}
