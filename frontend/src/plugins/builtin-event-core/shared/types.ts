import type { CourseEvent, CourseEventType, CourseSection, ScheduleItem, WeekPattern } from '@/services/schedule';

export type { CourseEvent, CourseEventType, CourseSection, ScheduleItem, WeekPattern };

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

export type EventSource = 'schedule' | 'todo' | 'custom';
export type SkippedDisplayMode = 'grayed' | 'hidden';
export type CalendarViewMode = 'week' | 'month';

export interface CalendarEventColorConfig {
  schedule: string;
  todo: string;
  custom: string;
}

export interface CalendarSettingsState {
  skippedDisplay: SkippedDisplayMode;
  eventColors: CalendarEventColorConfig;
  highlightConflicts: boolean;
  dayStartMinutes: number;
  dayEndMinutes: number;
}

export interface SemesterDateRange {
  startDate: Date;
  endDate: Date;
}

export interface CalendarEventData {
  id: string;
  eventId: string;
  source: EventSource;
  title: string;
  courseId: string;
  courseName: string;
  eventTypeCode: string;
  start: Date;
  end: Date;
  week: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  color: string;
  isSkipped: boolean;
  isConflict: boolean;
  conflictGroupId?: string | null;
  enable: boolean;
  note?: string | null;
}

export interface CalendarEventPatch {
  skip?: boolean;
  enable?: boolean;
}
