import React from 'react';
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
  showWeekends: boolean;
  isPending: boolean;
  onWeekChange: (week: number) => void;
  onEventClick: (event: CalendarEventData) => void;
}

const dayFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_OPTIONS = DAY_OF_WEEK_OPTIONS.filter((day) => day.value <= 5);
const HIDE_SCROLLBAR_CLASS = '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';
const OVERFLOW_SHADOW_COLOR = 'color-mix(in oklab, var(--color-foreground) 14%, transparent)';

type OverflowShadowState = {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
};

const useOverflowShadows = () => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [state, setState] = React.useState<OverflowShadowState>({
    top: false,
    right: false,
    bottom: false,
    left: false,
  });

  const updateState = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const hasOverflowX = el.scrollWidth - el.clientWidth > 1;
    const hasOverflowY = el.scrollHeight - el.clientHeight > 1;

    const next: OverflowShadowState = {
      top: hasOverflowY && el.scrollTop > 1,
      right: hasOverflowX && el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      bottom: hasOverflowY && el.scrollTop + el.clientHeight < el.scrollHeight - 1,
      left: hasOverflowX && el.scrollLeft > 1,
    };

    setState((prev) => (
      prev.top === next.top
      && prev.right === next.right
      && prev.bottom === next.bottom
      && prev.left === next.left
        ? prev
        : next
    ));
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    updateState();

    const handleScroll = () => updateState();
    el.addEventListener('scroll', handleScroll, { passive: true });

    const observer = new ResizeObserver(() => updateState());
    observer.observe(el);
    if (el.firstElementChild instanceof HTMLElement) {
      observer.observe(el.firstElementChild);
    }

    window.addEventListener('resize', updateState);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      observer.disconnect();
      window.removeEventListener('resize', updateState);
    };
  }, [updateState]);

  const shadowStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    const shadows: string[] = [];
    if (state.top) shadows.push(`inset 0 12px 12px -12px ${OVERFLOW_SHADOW_COLOR}`);
    if (state.right) shadows.push(`inset -12px 0 12px -12px ${OVERFLOW_SHADOW_COLOR}`);
    if (state.bottom) shadows.push(`inset 0 -12px 12px -12px ${OVERFLOW_SHADOW_COLOR}`);
    if (state.left) shadows.push(`inset 12px 0 12px -12px ${OVERFLOW_SHADOW_COLOR}`);

    if (shadows.length === 0) return undefined;
    return { boxShadow: shadows.join(', ') };
  }, [state.bottom, state.left, state.right, state.top]);

  return { containerRef, shadowStyle };
};

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
  showWeekends: boolean;
  onEventClick: (event: CalendarEventData) => void;
}> = ({ events, weekStartDate, dayStartMinutes, dayEndMinutes, highlightConflicts, showWeekends, onEventClick }) => {
  const { containerRef, shadowStyle } = useOverflowShadows();
  const eventsMap = React.useMemo(() => eventsByDay(events), [events]);
  const dayColumns = React.useMemo(
    () => (showWeekends ? DAY_OF_WEEK_OPTIONS : WEEKDAY_OPTIONS),
    [showWeekends],
  );
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
  const resolveHourMarkTop = React.useCallback((minute: number) => {
    const top = ((minute - minuteWindow.start) / totalMinutes) * calendarHeight;
    if (minute === minuteWindow.end) {
      return Math.max(0, calendarHeight - 1);
    }
    return top;
  }, [calendarHeight, minuteWindow.end, minuteWindow.start, totalMinutes]);

  const hourMarks = React.useMemo(() => {
    const marks: number[] = [];
    const firstHour = Math.ceil(minuteWindow.start / 60) * 60;

    marks.push(minuteWindow.start);
    for (let minute = firstHour; minute < minuteWindow.end; minute += 60) {
      if (marks[marks.length - 1] === minute) continue;
      marks.push(minute);
    }
    if (marks[marks.length - 1] !== minuteWindow.end) {
      marks.push(minuteWindow.end);
    }

    return marks;
  }, [minuteWindow.end, minuteWindow.start]);

  return (
    <div className="relative h-full min-h-0">
      <div
        ref={containerRef}
        className={`relative isolate z-0 h-full min-h-0 w-full max-w-full overflow-y-auto overflow-x-auto rounded-md border border-border/70 bg-background dark:bg-transparent ${HIDE_SCROLLBAR_CLASS}`}
      >
        <div className="w-[max(100%,840px)]">
          <div className="grid" style={{ gridTemplateColumns: `72px repeat(${dayColumns.length}, minmax(0, 1fr))` }}>
          <div className="sticky top-0 left-0 z-40 rounded-tl-md border-r border-b border-border/70 bg-muted/65 px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-md dark:bg-transparent">
            Time
          </div>
          {dayColumns.map((day, dayIndex) => {
            const date = addDays(weekStartDate, dayIndex);
            return (
              <div
                key={day.value}
                className={`sticky top-0 z-30 border-r border-b border-border/70 bg-muted/65 px-3 py-2 backdrop-blur-md dark:bg-transparent ${
                  dayIndex === dayColumns.length - 1 ? 'rounded-tr-md border-r-0' : ''
                }`}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{day.label}</p>
                <p className="text-sm font-semibold">{dayFormatter.format(date)}</p>
              </div>
            );
          })}

          <div className="sticky left-0 z-20 relative border-r border-border/70 bg-muted/45 backdrop-blur-md dark:bg-transparent" style={{ height: `${calendarHeight}px` }}>
            {hourMarks.map((minute) => {
              const top = resolveHourMarkTop(minute);
              const isLastMark = minute === minuteWindow.end;
              return (
                <div
                  key={minute}
                  className="absolute inset-x-0 border-t border-border/40 px-1 text-[10px] text-muted-foreground"
                  style={{ top: `${top}px` }}
                >
                  <span className={isLastMark ? '-translate-y-full inline-block' : undefined}>
                    {formatHour(minute)}
                  </span>
                </div>
              );
            })}
          </div>

          {dayColumns.map((day, dayIndex) => {
            const date = addDays(weekStartDate, dayIndex);
            const dayKey = keyForDate(date);
            const dayEvents = eventsMap.get(dayKey) ?? [];

            return (
              <div key={day.value} className="relative border-r border-border/70 bg-background dark:bg-transparent last:border-r-0" style={{ height: `${calendarHeight}px` }}>
                {hourMarks.map((minute) => {
                  const top = resolveHourMarkTop(minute);
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
                        'absolute right-1 left-1 z-[1] overflow-hidden rounded-md border border-l-[3px] px-2 py-1 text-left text-[11px] leading-tight shadow-sm transition-colors',
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
      <div className="pointer-events-none absolute inset-0 rounded-md" style={shadowStyle} />
    </div>
  );
};

const MonthView: React.FC<{
  events: CalendarEventData[];
  monthAnchorDate: Date;
  semesterRange: SemesterDateRange;
  highlightConflicts: boolean;
  showWeekends: boolean;
  onNavigateDate: (date: Date) => void;
  onEventClick: (event: CalendarEventData) => void;
}> = ({ events, monthAnchorDate, semesterRange, highlightConflicts, showWeekends, onNavigateDate, onEventClick }) => {
  const { containerRef, shadowStyle } = useOverflowShadows();
  const monthStart = React.useMemo(() => new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth(), 1), [monthAnchorDate]);
  const monthGridStart = React.useMemo(() => startOfWeekMonday(monthStart), [monthStart]);
  const monthGridDates = React.useMemo(() => {
    return Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index));
  }, [monthGridStart]);
  const dayColumns = React.useMemo(
    () => (showWeekends ? DAY_OF_WEEK_OPTIONS : WEEKDAY_OPTIONS),
    [showWeekends],
  );
  const visibleMonthGridDates = React.useMemo(() => {
    if (showWeekends) return monthGridDates;
    return monthGridDates.filter((date) => {
      const day = date.getDay();
      return day !== 0 && day !== 6;
    });
  }, [monthGridDates, showWeekends]);

  const eventsMap = React.useMemo(() => eventsByDay(events), [events]);
  const semesterStart = normalizeToDay(semesterRange.startDate).getTime();
  const semesterEnd = normalizeToDay(semesterRange.endDate).getTime();

  return (
    <div className="relative h-full min-h-0">
      <div ref={containerRef} className={`h-full min-h-0 w-full max-w-full overflow-y-auto overflow-x-auto ${HIDE_SCROLLBAR_CLASS}`}>
        <div className="w-[max(100%,720px)] rounded-md border border-border/70 bg-background dark:bg-transparent">
        <div
          className="sticky top-0 z-30 grid border-b border-border/70 bg-muted/65 backdrop-blur-md dark:bg-transparent"
          style={{ gridTemplateColumns: `repeat(${dayColumns.length}, minmax(0, 1fr))` }}
        >
          {dayColumns.map((day, index) => (
            <div
              key={day.value}
              className={`px-2 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground ${
                index === 0 ? 'rounded-tl-md' : ''
              } ${index === dayColumns.length - 1 ? 'rounded-tr-md' : ''}`}
            >
              {day.label}
            </div>
          ))}
        </div>

          <div className="grid" style={{ gridTemplateColumns: `repeat(${dayColumns.length}, minmax(0, 1fr))` }}>
          {visibleMonthGridDates.map((date, index) => {
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
                  isCurrentMonth ? 'bg-background dark:bg-transparent' : 'bg-muted/20 dark:bg-transparent',
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
                  {dayEvents.length > CALENDAR_MAX_EVENT_LINES_PER_DAY ? (
                    <p className="text-[11px] text-muted-foreground">More events</p>
                  ) : null}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-md" style={shadowStyle} />
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
  showWeekends,
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
    setCalendarAnchorDate(targetDate);
  }, [safeWeek, semesterRange.startDate]);

  const weekStartDate = viewMode === 'month'
    ? startOfWeekMonday(calendarAnchorDate)
    : weekStartFromSemester(semesterRange.startDate, safeWeek);

  const handleNavigateDate = (date: Date) => {
    setCalendarAnchorDate(date);
    syncWeekFromDate(date);
  };

  return (
    <div
      className={
        isPending
          ? 'h-full min-h-0 min-w-0 pointer-events-none opacity-75 transition-opacity duration-200 motion-reduce:transition-none'
          : 'h-full min-h-0 min-w-0 transition-opacity duration-200 motion-reduce:transition-none'
      }
    >
      {viewMode === 'month' ? (
        <MonthView
          events={events}
          monthAnchorDate={calendarAnchorDate}
          semesterRange={semesterRange}
          highlightConflicts={highlightConflicts}
          showWeekends={showWeekends}
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
          showWeekends={showWeekends}
          onEventClick={onEventClick}
        />
      )}
    </div>
  );
};
