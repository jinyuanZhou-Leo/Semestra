import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CALENDAR_MIN_EVENT_HEIGHT,
  CALENDAR_PIXEL_PER_MINUTE,
  CALENDAR_MAX_EVENT_LINES_PER_DAY,
  DAY_OF_WEEK_OPTIONS,
} from '../../shared/constants';
import type { CalendarEventData, CalendarViewMode, SemesterDateRange } from '../../shared/types';
import { addDays, formatHour, startOfWeekMonday } from '../../shared/utils';

interface FullCalendarViewProps {
  events: CalendarEventData[];
  week: number;
  maxWeek: number;
  viewMode: CalendarViewMode;
  semesterRange: SemesterDateRange;
  dayStartMinutes: number;
  dayEndMinutes: number;
  highlightConflicts: boolean;
  isPending: boolean;
  onWeekChange: (week: number) => void;
  onEventClick: (event: CalendarEventData) => void;
}

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'short' });
const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' });
const fullDateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const DAY_MS = 24 * 60 * 60 * 1000;

const keyForDate = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const normalizeToDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addAlpha = (hexColor: string, alphaHex = '22') => {
  if (!/^#[0-9a-fA-F]{6}$/.test(hexColor)) return hexColor;
  return `${hexColor}${alphaHex}`;
};

const weekStartFromSemester = (semesterStartDate: Date, week: number) => {
  return addDays(startOfWeekMonday(semesterStartDate), (Math.max(1, week) - 1) * 7);
};

const weekFromDate = (semesterStartDate: Date, date: Date) => {
  const semesterStart = startOfWeekMonday(semesterStartDate).getTime();
  const targetStart = startOfWeekMonday(date).getTime();
  return Math.floor((targetStart - semesterStart) / DAY_MS / 7) + 1;
};

const eventsByDay = (events: CalendarEventData[]) => {
  const map = new Map<string, CalendarEventData[]>();

  for (const event of events) {
    const key = keyForDate(event.start);
    const dayEvents = map.get(key) ?? [];
    dayEvents.push(event);
    map.set(key, dayEvents);
  }

  for (const [key, dayEvents] of map.entries()) {
    map.set(
      key,
      [...dayEvents].sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime()),
    );
  }

  return map;
};

const WeekView: React.FC<{
  events: CalendarEventData[];
  weekStartDate: Date;
  dayStartMinutes: number;
  dayEndMinutes: number;
  highlightConflicts: boolean;
  onEventClick: (event: CalendarEventData) => void;
}> = ({ events, weekStartDate, dayStartMinutes, dayEndMinutes, highlightConflicts, onEventClick }) => {
  const eventsMap = React.useMemo(() => eventsByDay(events), [events]);
  const minuteWindow = React.useMemo(() => {
    let start = Math.max(0, Math.min(23 * 60 + 59, Math.floor(dayStartMinutes)));
    let end = Math.max(0, Math.min(23 * 60 + 59, Math.floor(dayEndMinutes)));

    if (end <= start) {
      end = Math.min(23 * 60 + 59, start + 60);
    }

    if (end - start < 60) {
      start = Math.max(0, end - 60);
    }

    return { start, end };
  }, [dayEndMinutes, dayStartMinutes]);

  const totalMinutes = Math.max(60, minuteWindow.end - minuteWindow.start);
  const calendarHeight = Math.max(totalMinutes * CALENDAR_PIXEL_PER_MINUTE, 320);

  const hourMarks = React.useMemo(() => {
    const marks: number[] = [];
    const firstHour = Math.ceil(minuteWindow.start / 60) * 60;

    marks.push(minuteWindow.start);
    for (let minute = firstHour; minute < minuteWindow.end; minute += 60) {
      marks.push(minute);
    }
    if (marks[marks.length - 1] !== minuteWindow.end) {
      marks.push(minuteWindow.end);
    }

    return marks;
  }, [minuteWindow.end, minuteWindow.start]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[960px] rounded-md border border-border/70 bg-background">
        <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))]">
          <div className="border-r border-b border-border/70 bg-muted/35 px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Time
          </div>
          {DAY_OF_WEEK_OPTIONS.map((day, dayIndex) => {
            const date = addDays(weekStartDate, dayIndex);
            return (
              <div key={day.value} className="last:border-r-0 border-r border-b border-border/70 bg-muted/25 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{day.label}</p>
                <p className="text-sm font-semibold">{dayFormatter.format(date)}</p>
              </div>
            );
          })}

          <div className="relative border-r border-border/70 bg-muted/20" style={{ height: `${calendarHeight}px` }}>
            {hourMarks.map((minute) => {
              const top = ((minute - minuteWindow.start) / totalMinutes) * calendarHeight;
              return (
                <div
                  key={minute}
                  className="absolute inset-x-0 border-t border-border/40 px-1 text-[10px] text-muted-foreground"
                  style={{ top: `${top}px` }}
                >
                  {formatHour(minute)}
                </div>
              );
            })}
          </div>

          {DAY_OF_WEEK_OPTIONS.map((day, dayIndex) => {
            const date = addDays(weekStartDate, dayIndex);
            const dayKey = keyForDate(date);
            const dayEvents = eventsMap.get(dayKey) ?? [];

            return (
              <div key={day.value} className="relative last:border-r-0 border-r border-border/70 bg-background" style={{ height: `${calendarHeight}px` }}>
                {hourMarks.map((minute) => {
                  const top = ((minute - minuteWindow.start) / totalMinutes) * calendarHeight;
                  return <div key={minute} className="absolute inset-x-0 border-t border-border/35" style={{ top: `${top}px` }} />;
                })}

                {dayEvents.map((event) => {
                  const startMinutes = (event.start.getHours() * 60) + event.start.getMinutes();
                  const endMinutes = Math.max((event.end.getHours() * 60) + event.end.getMinutes(), startMinutes + 30);
                  const visibleStart = Math.max(startMinutes, minuteWindow.start);
                  const visibleEnd = Math.min(endMinutes, minuteWindow.end);

                  if (visibleEnd <= visibleStart) return null;

                  const top = ((visibleStart - minuteWindow.start) / totalMinutes) * calendarHeight;
                  const rawHeight = ((visibleEnd - visibleStart) / totalMinutes) * calendarHeight;
                  const height = Math.max(rawHeight, CALENDAR_MIN_EVENT_HEIGHT);
                  const boundedTop = Math.max(0, Math.min(top, calendarHeight - CALENDAR_MIN_EVENT_HEIGHT));
                  const boundedHeight = Math.min(height, calendarHeight - boundedTop);

                  if (boundedHeight <= 0) return null;

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEventClick(event)}
                      className={[
                        'absolute right-1 left-1 z-10 overflow-hidden rounded-md border border-l-[3px] px-2 py-1 text-left text-[11px] leading-tight shadow-sm transition-colors',
                        'focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none',
                        'hover:bg-accent/30',
                        event.isSkipped ? 'opacity-55 grayscale' : '',
                        highlightConflicts && event.isConflict ? 'border-destructive/50' : 'border-border/70',
                      ].join(' ')}
                      style={{
                        top: `${boundedTop}px`,
                        height: `${boundedHeight}px`,
                        borderLeftColor: event.color,
                        backgroundColor: addAlpha(event.color, '1f'),
                      }}
                      aria-label={`Open event ${event.title}`}
                    >
                      <div className="truncate font-medium text-foreground">{event.courseName}</div>
                      <div className="truncate text-foreground/80">{event.eventTypeCode}</div>
                      <div className="truncate text-foreground/70">{event.startTime} - {event.endTime}</div>
                    </button>
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

const MonthView: React.FC<{
  events: CalendarEventData[];
  monthAnchorDate: Date;
  semesterRange: SemesterDateRange;
  highlightConflicts: boolean;
  onNavigateDate: (date: Date) => void;
  onEventClick: (event: CalendarEventData) => void;
}> = ({ events, monthAnchorDate, semesterRange, highlightConflicts, onNavigateDate, onEventClick }) => {
  const monthStart = React.useMemo(() => new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth(), 1), [monthAnchorDate]);
  const monthGridStart = React.useMemo(() => startOfWeekMonday(monthStart), [monthStart]);
  const monthGridDates = React.useMemo(() => {
    return Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index));
  }, [monthGridStart]);

  const eventsMap = React.useMemo(() => eventsByDay(events), [events]);
  const semesterStart = normalizeToDay(semesterRange.startDate).getTime();
  const semesterEnd = normalizeToDay(semesterRange.endDate).getTime();

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border/70 bg-background">
        <div className="grid grid-cols-7 border-b border-border/70 bg-muted/25">
          {DAY_OF_WEEK_OPTIONS.map((day) => (
            <div key={day.value} className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {day.label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {monthGridDates.map((date, index) => {
            const dayKey = keyForDate(date);
            const dayEvents = eventsMap.get(dayKey) ?? [];
            const isCurrentMonth = date.getMonth() === monthAnchorDate.getMonth();
            const dayTime = normalizeToDay(date).getTime();
            const isOutOfSemester = dayTime < semesterStart || dayTime > semesterEnd;

            return (
              <div
                key={`${dayKey}-${index}`}
                className={[
                  'min-h-[132px] border-r border-b border-border/70 p-2 last:border-r-0',
                  isCurrentMonth ? 'bg-background' : 'bg-muted/20',
                  isOutOfSemester ? 'opacity-50' : '',
                ].join(' ')}
              >
                <div className="mb-1 flex items-center justify-between">
                  <button
                    type="button"
                    className="rounded px-1 text-xs font-medium hover:bg-accent"
                    onClick={() => onNavigateDate(date)}
                  >
                    {date.getDate()}
                  </button>
                  {dayEvents.length > 0 ? <Badge variant="outline">{dayEvents.length}</Badge> : null}
                </div>

                <div className="space-y-1">
                  {dayEvents.slice(0, CALENDAR_MAX_EVENT_LINES_PER_DAY).map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEventClick(event)}
                      className={[
                        'w-full truncate rounded px-1.5 py-1 text-left text-[11px] transition-colors',
                        'hover:bg-accent/50 focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none',
                        event.isSkipped ? 'opacity-55 grayscale' : '',
                        highlightConflicts && event.isConflict ? 'ring-1 ring-destructive/60' : '',
                      ].join(' ')}
                      style={{ backgroundColor: addAlpha(event.color, '1f'), borderLeft: `2px solid ${event.color}` }}
                    >
                      {formatHour(event.start.getHours() * 60 + event.start.getMinutes())} {event.courseName}
                    </button>
                  ))}
                  {dayEvents.length > CALENDAR_MAX_EVENT_LINES_PER_DAY && (
                    <p className="text-[11px] text-muted-foreground">
                      +{dayEvents.length - CALENDAR_MAX_EVENT_LINES_PER_DAY} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const FullCalendarView: React.FC<FullCalendarViewProps> = ({
  events,
  week,
  viewMode,
  semesterRange,
  dayStartMinutes,
  dayEndMinutes,
  highlightConflicts,
  isPending,
  maxWeek,
  onWeekChange,
  onEventClick,
}) => {
  const safeWeek = Math.max(1, Math.min(maxWeek, week));
  const [calendarAnchorDate, setCalendarAnchorDate] = React.useState<Date>(weekStartFromSemester(semesterRange.startDate, safeWeek));

  const syncWeekFromDate = React.useCallback((date: Date) => {
    const nextWeek = Math.max(1, Math.min(maxWeek, weekFromDate(semesterRange.startDate, date)));
    if (nextWeek !== week) {
      onWeekChange(nextWeek);
    }
  }, [maxWeek, onWeekChange, semesterRange.startDate, week]);

  React.useEffect(() => {
    const targetDate = weekStartFromSemester(semesterRange.startDate, safeWeek);
    if (viewMode === 'week') {
      setCalendarAnchorDate(targetDate);
    }
  }, [safeWeek, semesterRange.startDate, viewMode]);

  const weekStartDate = viewMode === 'month'
    ? startOfWeekMonday(calendarAnchorDate)
    : weekStartFromSemester(semesterRange.startDate, safeWeek);
  const weekEndDate = addDays(weekStartDate, 6);
  const title = viewMode === 'month'
    ? `${monthFormatter.format(calendarAnchorDate)} ${calendarAnchorDate.getFullYear()}`
    : `${fullDateFormatter.format(weekStartDate)} - ${fullDateFormatter.format(weekEndDate)}`;

  const handleStep = (direction: 'prev' | 'next') => {
    const delta = direction === 'prev' ? -1 : 1;
    if (viewMode === 'week') {
      onWeekChange(Math.max(1, Math.min(maxWeek, safeWeek + delta)));
      return;
    }

    const nextMonthAnchor = new Date(calendarAnchorDate.getFullYear(), calendarAnchorDate.getMonth() + delta, 1);
    setCalendarAnchorDate(nextMonthAnchor);
    syncWeekFromDate(nextMonthAnchor);
  };

  const handleNavigateDate = (date: Date) => {
    setCalendarAnchorDate(date);
    syncWeekFromDate(date);
  };

  return (
    <div className={isPending ? 'pointer-events-none opacity-75 transition-opacity duration-200 motion-reduce:transition-none' : 'transition-opacity duration-200 motion-reduce:transition-none'}>
      <div className="mb-3 flex items-center justify-between rounded-md border bg-muted/20 px-2 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => handleStep('prev')}
          disabled={safeWeek <= 1 && viewMode === 'week'}
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-semibold">{title}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => handleStep('next')}
          disabled={safeWeek >= maxWeek && viewMode === 'week'}
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {viewMode === 'month' ? (
        <MonthView
          events={events}
          monthAnchorDate={calendarAnchorDate}
          semesterRange={semesterRange}
          highlightConflicts={highlightConflicts}
          onNavigateDate={handleNavigateDate}
          onEventClick={onEventClick}
        />
      ) : (
        <WeekView
          events={events}
          weekStartDate={weekStartDate}
          dayStartMinutes={dayStartMinutes}
          dayEndMinutes={dayEndMinutes}
          highlightConflicts={highlightConflicts}
          onEventClick={onEventClick}
        />
      )}
    </div>
  );
};
