import React from 'react';
import type { ScheduleItem } from '@/services/schedule';
import {
  CALENDAR_DEFAULT_END_MINUTES,
  CALENDAR_DEFAULT_START_MINUTES,
  CALENDAR_MIN_EVENT_HEIGHT,
  CALENDAR_PIXEL_PER_MINUTE,
  DAY_OF_WEEK_OPTIONS,
} from '../shared/constants';
import { formatHour, toMinutes } from '../shared/utils';

interface WeeklyCalendarViewProps {
  items: ScheduleItem[];
  emptyMessage: string;
}

export const WeeklyCalendarView: React.FC<WeeklyCalendarViewProps> = ({ items, emptyMessage }) => {
  const calendarData = React.useMemo(() => {
    if (items.length === 0) {
      return {
        startMinute: CALENDAR_DEFAULT_START_MINUTES,
        endMinute: CALENDAR_DEFAULT_END_MINUTES,
        columns: new Map<number, ScheduleItem[]>(),
      };
    }

    let minMinute = Number.POSITIVE_INFINITY;
    let maxMinute = Number.NEGATIVE_INFINITY;
    const columns = new Map<number, ScheduleItem[]>();

    for (const item of items) {
      const startMinute = toMinutes(item.startTime);
      const endMinute = Math.max(toMinutes(item.endTime), startMinute + 30);
      minMinute = Math.min(minMinute, startMinute);
      maxMinute = Math.max(maxMinute, endMinute);
      const dayItems = columns.get(item.dayOfWeek) ?? [];
      dayItems.push(item);
      columns.set(item.dayOfWeek, dayItems);
    }

    for (const [day, dayItems] of columns.entries()) {
      columns.set(day, [...dayItems].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)));
    }

    const startMinute = Math.max(0, Math.floor(minMinute / 60) * 60);
    const endMinute = Math.max(startMinute + 60, Math.ceil(maxMinute / 60) * 60);

    return { startMinute, endMinute, columns };
  }, [items]);

  const totalMinutes = Math.max(calendarData.endMinute - calendarData.startMinute, 60);
  const calendarHeight = Math.max(totalMinutes * CALENDAR_PIXEL_PER_MINUTE, 320);

  const hourMarks = React.useMemo(() => {
    const marks: number[] = [];
    for (let minute = calendarData.startMinute; minute <= calendarData.endMinute; minute += 60) {
      marks.push(minute);
    }
    return marks;
  }, [calendarData.endMinute, calendarData.startMinute]);

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[880px] select-none rounded-md border border-border/70 bg-background">
        <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))]">
          <div className="border-r border-b border-border/70 bg-muted/35 px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Time
          </div>
          {DAY_OF_WEEK_OPTIONS.map((day) => (
            <div
              key={day.value}
              className="last:border-r-0 border-r border-b border-border/70 bg-muted/35 px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground"
            >
              {day.label}
            </div>
          ))}

          <div className="relative border-r border-border/70 bg-muted/25" style={{ height: `${calendarHeight}px` }}>
            {hourMarks.map((minute) => {
              const top = ((minute - calendarData.startMinute) / totalMinutes) * calendarHeight;
              return (
                <div
                  key={minute}
                  className="absolute inset-x-0 border-t border-border/50 px-1 text-[10px] text-muted-foreground"
                  style={{ top: `${top}px` }}
                >
                  {formatHour(minute)}
                </div>
              );
            })}
          </div>

          {DAY_OF_WEEK_OPTIONS.map((day) => {
            const dayItems = calendarData.columns.get(day.value) ?? [];

            return (
              <div
                key={day.value}
                className="relative last:border-r-0 border-r border-border/70 bg-background"
                style={{ height: `${calendarHeight}px` }}
              >
                {hourMarks.map((minute) => {
                  const top = ((minute - calendarData.startMinute) / totalMinutes) * calendarHeight;
                  return <div key={minute} className="absolute inset-x-0 border-t border-border/40" style={{ top: `${top}px` }} />;
                })}

                {dayItems.map((item) => {
                  const start = toMinutes(item.startTime);
                  const end = Math.max(toMinutes(item.endTime), start + 30);
                  const top = ((start - calendarData.startMinute) / totalMinutes) * calendarHeight;
                  const rawHeight = ((end - start) / totalMinutes) * calendarHeight;
                  const height = Math.max(rawHeight, CALENDAR_MIN_EVENT_HEIGHT);

                  const toneClass = item.skip
                    ? 'border-border/80 bg-muted/70 text-muted-foreground'
                    : item.isConflict
                      ? 'border-destructive/40 bg-destructive/15 text-destructive'
                      : 'border-primary/30 bg-primary/10 text-foreground';

                  return (
                    <div
                      key={`${item.eventId}-${item.week}-${item.dayOfWeek}-${item.startTime}`}
                      className={`absolute right-1 left-1 z-10 overflow-hidden rounded-md border px-2 py-1 text-[11px] leading-tight shadow-sm ${toneClass}`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <div className="truncate font-medium">{item.courseName}</div>
                      <div className="truncate opacity-85">{item.eventTypeCode}</div>
                      <div className="truncate opacity-75">{item.startTime} - {item.endTime}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
