// input:  [schedule export items, calendar export title metadata, calendar time window, event color, and shared FullCalendar surface]
// output: [SemesterScheduleExportSurface renderer plus export item/dimension helpers]
// pos:    [DOM-based schedule export surface that reuses the Calendar FullCalendar renderer so PNG/PDF output stays aligned with the live Calendar UI]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import type { ScheduleItem, WeekPattern } from '@/services/schedule';
import type { CalendarEventData } from '../../shared/types';
import { BUILTIN_CALENDAR_SOURCE_SCHEDULE } from '../../shared/constants';
import {
  addDays,
  parseTimeOnDate,
  startOfWeekMonday,
  toMinutes,
} from '../../shared/utils';
import { CalendarFullCalendarSurface } from './FullCalendarView';

interface SemesterScheduleExportSurfaceProps {
  title: string;
  subtitle: string;
  items: ScheduleItem[];
  dayStartMinutes: number;
  dayEndMinutes: number;
  eventColor: string;
  highlightConflicts: boolean;
  showWeekends: boolean;
  weekViewDayCount: number;
}

export interface SemesterScheduleExportDimensions {
  width: number;
  height: number;
}

const EXPORT_WEEK_START = startOfWeekMonday(new Date(2020, 0, 6));
const EXPORT_VALID_RANGE_END = addDays(EXPORT_WEEK_START, 7);
const EXPORT_MIN_HEIGHT = 980;
const EXPORT_BASE_HEIGHT = 220;
const EXPORT_HALF_HOUR_HEIGHT = 48;
const EXPORT_WIDTH = 1400;

const EXPORT_VALID_RANGE = {
  start: EXPORT_WEEK_START,
  end: EXPORT_VALID_RANGE_END,
};

const normalizeWeekPattern = (value?: WeekPattern | null): WeekPattern => (
  value === 'ALTERNATING' ? 'ALTERNATING' : 'EVERY'
);

const isRenderedAsSkipped = (item: ScheduleItem) => item.renderState === 'SKIPPED_GRAY' || Boolean(item.skip);

export const getSemesterScheduleExportDimensions = (
  dayStartMinutes: number,
  dayEndMinutes: number,
): SemesterScheduleExportDimensions => {
  const totalMinutes = Math.max(60, dayEndMinutes - dayStartMinutes);
  return {
    width: EXPORT_WIDTH,
    height: Math.max(EXPORT_MIN_HEIGHT, Math.round((totalMinutes / 30) * EXPORT_HALF_HOUR_HEIGHT) + EXPORT_BASE_HEIGHT),
  };
};

export const dedupeExportScheduleItems = (items: ScheduleItem[]) => {
  const byEventId = new Map<string, ScheduleItem>();

  for (const item of items) {
    const normalizedItem: ScheduleItem = {
      ...item,
      weekPattern: normalizeWeekPattern(item.weekPattern),
      skip: isRenderedAsSkipped(item),
    };
    const existing = byEventId.get(item.eventId);
    if (!existing) {
      byEventId.set(item.eventId, normalizedItem);
      continue;
    }

    const mergedConflict = Boolean(existing.isConflict || normalizedItem.isConflict);
    if (existing.skip && !normalizedItem.skip) {
      byEventId.set(item.eventId, {
        ...normalizedItem,
        isConflict: mergedConflict,
      });
      continue;
    }

    byEventId.set(item.eventId, {
      ...existing,
      skip: existing.skip && normalizedItem.skip,
      isConflict: mergedConflict,
    });
  }

  return Array.from(byEventId.values()).sort((a, b) => (
    a.dayOfWeek - b.dayOfWeek
    || toMinutes(a.startTime) - toMinutes(b.startTime)
    || toMinutes(a.endTime) - toMinutes(b.endTime)
    || a.courseName.localeCompare(b.courseName)
  ));
};

const toExportCalendarEvent = (
  item: ScheduleItem,
  eventColor: string,
  index: number,
): CalendarEventData => {
  const targetDate = addDays(EXPORT_WEEK_START, Math.max(1, item.dayOfWeek) - 1);
  const start = parseTimeOnDate(targetDate, item.startTime);
  let end = parseTimeOnDate(targetDate, item.endTime);

  if (end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + (30 * 60 * 1000));
  }

  const weekPattern = normalizeWeekPattern(item.weekPattern);

  return {
    id: `export:${item.eventId}:${index}`,
    eventId: item.eventId,
    sourceId: BUILTIN_CALENDAR_SOURCE_SCHEDULE,
    title: item.title?.trim() || `${item.courseName} · ${item.eventTypeCode}`,
    courseId: item.courseId,
    courseName: item.courseName,
    eventTypeCode: item.eventTypeCode,
    start,
    end,
    allDay: false,
    week: 1,
    dayOfWeek: item.dayOfWeek,
    weekPattern,
    isRecurring: Boolean(weekPattern),
    startTime: item.startTime,
    endTime: item.endTime,
    color: eventColor,
    isSkipped: isRenderedAsSkipped(item),
    isConflict: item.isConflict,
    conflictGroupId: item.conflictGroupId,
    enable: item.enable,
    note: item.note,
  };
};

const toExportCalendarEvents = (
  items: ScheduleItem[],
  eventColor: string,
) => items.map((item, index) => toExportCalendarEvent(item, eventColor, index));

export const SemesterScheduleExportSurface: React.FC<SemesterScheduleExportSurfaceProps> = ({
  title,
  subtitle,
  items,
  dayStartMinutes,
  dayEndMinutes,
  eventColor,
  highlightConflicts,
  showWeekends,
}) => {
  const calendarEvents = React.useMemo(
    () => toExportCalendarEvents(items, eventColor),
    [eventColor, items],
  );
  const exportWeekViewDayCount = showWeekends ? 7 : 5;

  return (
    <div
      className="semestra-calendar-export-sheet flex h-full w-full flex-col gap-3 bg-background p-5 text-foreground"
      data-slot="calendar-export-sheet"
    >
      <header className="flex shrink-0 items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-xl font-semibold tracking-[-0.03em] text-foreground">
            {title}
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <p className="shrink-0 rounded-full border bg-card px-3 py-1 text-sm font-medium text-muted-foreground">
          Weekly timetable
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-card p-3 shadow-sm ring-1 ring-border/70">
        <CalendarFullCalendarSurface
          events={calendarEvents}
          viewMode="week"
          currentDate={EXPORT_WEEK_START}
          validRange={EXPORT_VALID_RANGE}
          dayStartMinutes={dayStartMinutes}
          dayEndMinutes={dayEndMinutes}
          weekViewDayCount={exportWeekViewDayCount}
          highlightConflicts={highlightConflicts}
          showWeekends={showWeekends}
          isPending={false}
          mode="export"
        />
      </div>
    </div>
  );
};
