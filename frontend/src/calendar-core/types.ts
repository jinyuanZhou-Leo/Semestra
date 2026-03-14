// input:  [React-facing calendar consumers, source loaders, todo completion metadata, and event refresh signals]
// output: [shared calendar-core event/source/context type contracts]
// pos:    [standalone calendar domain contract layer used by Calendar UI and external source registrations]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export interface SemesterDateRange {
  startDate: Date;
  endDate: Date;
  readingWeekStart: Date | null;
  readingWeekEnd: Date | null;
}

export interface CalendarEventData {
  id: string;
  eventId: string;
  sourceId: string;
  title: string;
  courseId: string;
  courseName: string;
  eventTypeCode: string;
  start: Date;
  end: Date;
  allDay: boolean;
  week: number;
  dayOfWeek: number;
  weekPattern?: string | null;
  isRecurring: boolean;
  startTime: string;
  endTime: string;
  color?: string;
  isSkipped: boolean;
  isConflict: boolean;
  conflictGroupId?: string | null;
  enable: boolean;
  note?: string | null;
  todoState?: {
    completed: boolean;
    listSource: 'course' | 'semester';
    listId: string;
  };
}

export interface CalendarEventPatch {
  skip?: boolean;
  enable?: boolean;
}

export interface CalendarSourceContext {
  semesterId: string;
  semesterRange: SemesterDateRange;
  maxWeek: number;
}

export type CalendarRefreshSignal =
  | { type: 'manual' }
  | {
    type: 'timetable';
    source: 'course' | 'semester';
    reason:
      | 'course-updated'
      | 'gradebook-assessments-updated'
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
  };

export interface CalendarSourceDefinition {
  id: string;
  ownerId: string;
  label: string;
  defaultColor: string;
  priority: number;
  getCached?: (context: CalendarSourceContext) => CalendarEventData[] | undefined;
  load: (context: CalendarSourceContext) => Promise<CalendarEventData[]>;
  invalidate?: (
    signal: CalendarRefreshSignal,
    context: CalendarSourceContext,
  ) => Promise<void> | void;
  shouldRefresh: (signal: CalendarRefreshSignal, context: CalendarSourceContext) => boolean;
  applyEventPatch?: (
    event: CalendarEventData,
    patch: CalendarEventPatch,
    context: CalendarSourceContext,
  ) => Promise<void>;
}
