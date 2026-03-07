// input:  [semester context, schedule/calendar services, todo tab storage, shared event bus, and calendar subcomponents]
// output: [Calendar tab runtime component with Reading Week-aware schedule + todo event rendering and scoped refresh behavior]
// pos:    [Built-in event-core calendar orchestrator for semester schedule visualization, Reading Week-aware navigation, todo overlays, and event edits]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { toast } from 'sonner';
import api, { type Course } from '@/services/api';
import scheduleService from '@/services/schedule';
import type { TabProps } from '@/services/tabRegistry';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BUILTIN_TIMETABLE_TODO_TAB_TYPE,
  CALENDAR_DEFAULT_VIEW_MODE,
  DEFAULT_WEEK,
} from '../../shared/constants';
import { timetableEventBus, useEventBus } from '../../shared/eventBus';
import { useScheduleData } from '../../shared/hooks/useScheduleData';
import type {
  CalendarEventData,
  CalendarEventPatch,
  CalendarSettingsState,
  CalendarViewMode,
  SemesterDateRange,
} from '../../shared/types';
import {
  addDays,
  buildCalendarEvents,
  getDisplayMaxWeek,
  getDisplayWeekNumber,
  getWeekFromSemesterDate,
  getWeekStartForSemester,
  isDateInReadingWeek,
  isReadingWeek,
  parseTimeOnDate,
  resolveSemesterDateRange,
  startOfWeekMonday,
  toMinutes,
} from '../../shared/utils';
import { CalendarToolbar } from './CalendarToolbar';
import { CalendarSkeleton } from './components/CalendarSkeleton';
import { normalizeCalendarSettings } from './settings';
import { normalizeCourseListStateFromTab, normalizeSemesterCustomLists, parseJsonObject } from '../todo/utils/todoData';
import type { SemesterCustomListStorage, TodoTask } from '../todo/types';

const FullCalendarView = React.lazy(async () => {
  const module = await import('./FullCalendarView');
  return { default: module.FullCalendarView };
});

const EventEditor = React.lazy(async () => {
  const module = await import('./EventEditor');
  return { default: module.EventEditor };
});

const FALLBACK_RANGE: SemesterDateRange = resolveSemesterDateRange(undefined, undefined, 16);
const rangeDateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const monthLabelFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const TODO_EVENT_DURATION_MINUTES = 30;
const TODO_DETAIL_MAX_PARALLEL_REQUESTS = 4;

type ScheduleReloadSkipToken = {
  courseId: string;
  semesterId: string;
  reason: 'event-updated';
};

const conflictOccurrenceKey = (event: CalendarEventData) => {
  if (!event.conflictGroupId) return null;
  return `${event.week}:${event.dayOfWeek}:${event.conflictGroupId}`;
};

const runWithConcurrencyLimit = async <T,>(tasks: Array<() => Promise<T>>, maxParallelRequests: number): Promise<T[]> => {
  if (tasks.length === 0) return [];

  const results = new Array<T>(tasks.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < tasks.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await tasks[currentIndex]();
    }
  };

  const workerCount = Math.min(tasks.length, Math.max(1, Math.floor(maxParallelRequests)));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
};

const buildTodoEvent = (
  task: TodoTask,
  semesterStartDate: Date,
  semesterEndDate: Date,
  color: string,
  courseId: string,
  courseName: string,
): CalendarEventData | null => {
  if (task.completed || !task.dueDate) return null;

  const targetDate = new Date(`${task.dueDate}T00:00:00`);
  if (!Number.isFinite(targetDate.getTime())) return null;

  const normalizedTargetDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const semesterStart = startOfWeekMonday(semesterStartDate);
  const semesterEnd = new Date(semesterEndDate.getFullYear(), semesterEndDate.getMonth(), semesterEndDate.getDate(), 23, 59, 59, 999);
  if (normalizedTargetDate.getTime() < semesterStart.getTime() || normalizedTargetDate.getTime() > semesterEnd.getTime()) {
    return null;
  }

  const week = getWeekFromSemesterDate(semesterStartDate, normalizedTargetDate);
  const day = normalizedTargetDate.getDay();
  const dayOfWeek = day === 0 ? 7 : day;
  const isAllDay = !task.dueTime;
  const start = isAllDay ? normalizedTargetDate : parseTimeOnDate(normalizedTargetDate, task.dueTime);
  const end = isAllDay
    ? addDays(normalizedTargetDate, 1)
    : new Date(start.getTime() + (TODO_EVENT_DURATION_MINUTES * 60 * 1000));

  return {
    id: `todo:${courseId}:${task.id}:${task.dueDate}:${task.dueTime || 'all-day'}`,
    eventId: task.id,
    source: 'todo',
    title: task.title.trim() || 'Todo',
    courseId,
    courseName,
    eventTypeCode: 'Todo',
    start,
    end,
    allDay: isAllDay,
    week,
    dayOfWeek,
    weekPattern: null,
    isRecurring: false,
    startTime: isAllDay ? 'All day' : task.dueTime,
    endTime: isAllDay ? 'All day' : `${String(Math.floor((toMinutes(task.dueTime) + TODO_EVENT_DURATION_MINUTES) / 60) % 24).padStart(2, '0')}:${String((toMinutes(task.dueTime) + TODO_EVENT_DURATION_MINUTES) % 60).padStart(2, '0')}`,
    color,
    isSkipped: false,
    isConflict: false,
    conflictGroupId: null,
    enable: true,
    note: task.description || null,
  };
};

export const CalendarTab: React.FC<TabProps> = ({ semesterId, settings: inputSettings }) => {
  const [week, setWeek] = React.useState(DEFAULT_WEEK);
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>(CALENDAR_DEFAULT_VIEW_MODE as CalendarViewMode);
  const settings = React.useMemo<CalendarSettingsState>(() => normalizeCalendarSettings(inputSettings), [inputSettings]);
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEventData | null>(null);
  const [isEventEditorOpen, setIsEventEditorOpen] = React.useState(false);
  const [semesterRange, setSemesterRange] = React.useState<SemesterDateRange>(FALLBACK_RANGE);
  const [monthAnchorDate, setMonthAnchorDate] = React.useState<Date>(FALLBACK_RANGE.startDate);
  const [optimisticPatches, setOptimisticPatches] = React.useState<Map<string, CalendarEventPatch>>(new Map());
  const [todoEvents, setTodoEvents] = React.useState<CalendarEventData[]>([]);
  const [todoReloadNonce, setTodoReloadNonce] = React.useState(0);
  const [viewportBoundHeight, setViewportBoundHeight] = React.useState<number | null>(null);
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const hasUserInteractedWithWeekRef = React.useRef(false);
  const skipNextScheduleReloadRef = React.useRef<ScheduleReloadSkipToken | null>(null);
  const updateViewportBoundHeight = React.useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const available = Math.floor(window.innerHeight - rect.top - 12);
    const nextHeight = Math.max(360, available);
    setViewportBoundHeight((previousHeight) => (previousHeight === nextHeight ? previousHeight : nextHeight));
  }, []);

  const {
    items,
    maxWeek,
    isLoading,
    error,
    reload,
  } = useScheduleData({
    semesterId,
    mode: 'all-weeks',
    withConflicts: true,
    enabled: Boolean(semesterId),
  });

  React.useEffect(() => {
    setWeek((currentWeek) => {
      const upperBound = Math.max(1, maxWeek);
      return Math.max(1, Math.min(upperBound, currentWeek));
    });
  }, [maxWeek]);

  React.useEffect(() => {
    hasUserInteractedWithWeekRef.current = false;
  }, [semesterId]);

  React.useEffect(() => {
    setMonthAnchorDate(semesterRange.startDate);
  }, [semesterId, semesterRange.startDate]);

  React.useEffect(() => {
    if (!semesterId) return;

    let isActive = true;

    const loadTodoCalendarEvents = async () => {
      const semester = await api.getSemester(semesterId);
      if (!isActive) return;

      const resolvedRange = resolveSemesterDateRange(
        semester.start_date,
        semester.end_date,
        Math.max(1, maxWeek),
        semester.reading_week_start,
        semester.reading_week_end,
      );
      setSemesterRange(resolvedRange);

      const courses = (semester.courses ?? []) as Course[];
      const coursesNeedingDetail = courses.filter((course) => !Array.isArray(course.tabs));
      const detailResponses = await runWithConcurrencyLimit(
        coursesNeedingDetail.map((course) => async () => {
          try {
            const detail = await api.getCourse(course.id);
            return { courseId: course.id, detail };
          } catch {
            return { courseId: course.id, detail: undefined };
          }
        }),
        TODO_DETAIL_MAX_PARALLEL_REQUESTS,
      );

      if (!isActive) return;

      const detailsByCourseId = new Map(detailResponses.map((item) => [item.courseId, item.detail]));
      const semesterTodoTab = semester.tabs?.find((tab) => tab.tab_type === BUILTIN_TIMETABLE_TODO_TAB_TYPE);
      const semesterCustomLists = normalizeSemesterCustomLists(parseJsonObject(semesterTodoTab?.settings));
      const courseTodoEvents = courses.flatMap((course) => {
        const detail = Array.isArray(course.tabs) ? course : detailsByCourseId.get(course.id);
        const todoTab = detail?.tabs?.find((tab) => tab.tab_type === BUILTIN_TIMETABLE_TODO_TAB_TYPE);
        const state = normalizeCourseListStateFromTab(course.id, course.name, todoTab);
        return state.tasks
          .map((task) => buildTodoEvent(task, resolvedRange.startDate, resolvedRange.endDate, settings.eventColors.todo, course.id, course.name))
          .filter((event): event is CalendarEventData => event !== null);
      });
      const customTodoEvents = semesterCustomLists.flatMap((list: SemesterCustomListStorage) => {
        return list.tasks
          .map((task) => buildTodoEvent(task, resolvedRange.startDate, resolvedRange.endDate, settings.eventColors.todo, list.id, list.name))
          .filter((event): event is CalendarEventData => event !== null);
      });
      setTodoEvents([...courseTodoEvents, ...customTodoEvents]);
    };

    void loadTodoCalendarEvents()
      .catch(() => {
        if (!isActive) return;
        setSemesterRange(resolveSemesterDateRange(undefined, undefined, Math.max(1, maxWeek)));
        setTodoEvents([]);
      });

    return () => {
      isActive = false;
    };
  }, [semesterId, maxWeek, settings.eventColors.todo, todoReloadNonce]);

  React.useEffect(() => {
    if (!error) return;
    toast.error(error.message || 'Failed to load calendar schedule.');
  }, [error]);

  const currentWeek = React.useMemo(() => {
    const semesterStart = startOfWeekMonday(semesterRange.startDate).getTime();
    const todayStart = startOfWeekMonday(new Date()).getTime();
    const rawWeek = Math.floor((todayStart - semesterStart) / WEEK_MS) + 1;
    const upperBound = Math.max(1, maxWeek);
    return Math.max(1, Math.min(upperBound, rawWeek));
  }, [maxWeek, semesterRange.startDate]);

  React.useEffect(() => {
    if (hasUserInteractedWithWeekRef.current) return;
    setWeek((previousWeek) => (previousWeek === currentWeek ? previousWeek : currentWeek));
  }, [currentWeek]);

  React.useEffect(() => {
    if (viewMode !== 'week') return;
    const nextAnchorDate = getWeekStartForSemester(semesterRange.startDate, week);
    setMonthAnchorDate((previousDate) => (
      previousDate.getTime() === nextAnchorDate.getTime()
        ? previousDate
        : nextAnchorDate
    ));
  }, [semesterRange.startDate, viewMode, week]);

  React.useLayoutEffect(() => {
    updateViewportBoundHeight();
  }, [
    updateViewportBoundHeight,
    settings.dayStartMinutes,
    settings.dayEndMinutes,
    settings.showWeekends,
    viewMode,
  ]);

  React.useEffect(() => {
    const card = cardRef.current;
    const resizeObserver = new ResizeObserver(() => {
      updateViewportBoundHeight();
    });

    window.addEventListener('resize', updateViewportBoundHeight);
    if (card) {
      resizeObserver.observe(card);
      if (card.parentElement) {
        resizeObserver.observe(card.parentElement);
      }
    }

    return () => {
      window.removeEventListener('resize', updateViewportBoundHeight);
      resizeObserver.disconnect();
    };
  }, [updateViewportBoundHeight]);

  useEventBus('timetable:schedule-data-changed', (payload) => {
    if (payload.source !== 'course' && payload.source !== 'semester') return;
    if (!payload.semesterId || payload.semesterId !== semesterId) return;

    setTodoReloadNonce((current) => current + 1);

    const skipToken = skipNextScheduleReloadRef.current;
    if (
      skipToken
      && payload.reason === skipToken.reason
      && payload.courseId === skipToken.courseId
      && payload.semesterId === skipToken.semesterId
    ) {
      skipNextScheduleReloadRef.current = null;
      return;
    }

    void reload();
  });

  const itemsWithPatches = React.useMemo(() => {
    if (optimisticPatches.size === 0) return items;

    return items.map((item) => {
      const patch = optimisticPatches.get(item.eventId);
      if (!patch) return item;
      return {
        ...item,
        skip: typeof patch.skip === 'boolean' ? patch.skip : item.skip,
        enable: typeof patch.enable === 'boolean' ? patch.enable : item.enable,
      };
    });
  }, [items, optimisticPatches]);

  const calendarEvents = React.useMemo(() => {
    const scheduleEvents = buildCalendarEvents(
      itemsWithPatches,
      semesterRange.startDate,
      settings.eventColors,
    );
    return [...scheduleEvents, ...todoEvents]
      .filter((event) => !isDateInReadingWeek(event.start, semesterRange))
      .sort((left, right) => {
      return Number(right.allDay) - Number(left.allDay) || left.start.getTime() - right.start.getTime() || left.title.localeCompare(right.title);
    });
  }, [itemsWithPatches, semesterRange, settings, todoEvents]);

  const conflictGroups = React.useMemo(() => {
    const groups = new Map<string, CalendarEventData[]>();

    for (const event of calendarEvents) {
      const groupKey = conflictOccurrenceKey(event);
      if (!groupKey) continue;
      const groupedEvents = groups.get(groupKey) ?? [];
      groupedEvents.push(event);
      groups.set(groupKey, groupedEvents);
    }

    return groups;
  }, [calendarEvents]);

  const eventsById = React.useMemo(() => {
    const map = new Map<string, CalendarEventData>();
    for (const event of calendarEvents) {
      if (!map.has(event.eventId)) {
        map.set(event.eventId, event);
      }
    }
    return map;
  }, [calendarEvents]);

  const handleWeekChange = React.useCallback((targetWeek: number) => {
    const boundedWeek = Math.max(1, Math.min(Math.max(1, maxWeek), targetWeek));
    hasUserInteractedWithWeekRef.current = true;
    setWeek(boundedWeek);
    setMonthAnchorDate(getWeekStartForSemester(semesterRange.startDate, boundedWeek));
  }, [maxWeek, semesterRange.startDate]);

  const handleNavigatePrevious = React.useCallback(() => {
    hasUserInteractedWithWeekRef.current = true;
    if (viewMode === 'month') {
      const targetDate = new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth() - 1, 1);
      setMonthAnchorDate(targetDate);
      setWeek(Math.max(1, Math.min(Math.max(1, maxWeek), getWeekFromSemesterDate(semesterRange.startDate, targetDate))));
      return;
    }

    setWeek((currentWeekValue) => Math.max(1, Math.min(Math.max(1, maxWeek), currentWeekValue - 1)));
  }, [maxWeek, monthAnchorDate, semesterRange.startDate, viewMode]);

  const handleNavigateNext = React.useCallback(() => {
    hasUserInteractedWithWeekRef.current = true;
    if (viewMode === 'month') {
      const targetDate = new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth() + 1, 1);
      setMonthAnchorDate(targetDate);
      setWeek(Math.max(1, Math.min(Math.max(1, maxWeek), getWeekFromSemesterDate(semesterRange.startDate, targetDate))));
      return;
    }

    setWeek((currentWeekValue) => Math.max(1, Math.min(Math.max(1, maxWeek), currentWeekValue + 1)));
  }, [maxWeek, monthAnchorDate, semesterRange.startDate, viewMode]);

  const handleToday = React.useCallback(() => {
    hasUserInteractedWithWeekRef.current = true;
    const today = new Date();
    setWeek(currentWeek);
    setMonthAnchorDate(today);
  }, [currentWeek]);

  const handleViewModeChange = React.useCallback((nextViewMode: CalendarViewMode) => {
    if (nextViewMode === viewMode) return;
    if (nextViewMode === 'month') {
      setMonthAnchorDate(getWeekStartForSemester(semesterRange.startDate, week));
    }
    setViewMode(nextViewMode);
  }, [semesterRange.startDate, viewMode, week]);

  const isCurrentMonth = React.useMemo(() => {
    const today = new Date();
    return today.getFullYear() === monthAnchorDate.getFullYear() && today.getMonth() === monthAnchorDate.getMonth();
  }, [monthAnchorDate]);

  const dateRangeLabel = React.useMemo(() => {
    if (viewMode === 'month') {
      return monthLabelFormatter.format(monthAnchorDate);
    }

    const safeWeek = Math.max(1, week);
    const weekStart = addDays(startOfWeekMonday(semesterRange.startDate), (safeWeek - 1) * 7);
    const weekEnd = addDays(weekStart, 6);
    return `${rangeDateFormatter.format(weekStart)} - ${rangeDateFormatter.format(weekEnd)}`;
  }, [monthAnchorDate, semesterRange.startDate, viewMode, week]);

  const displayWeekNumber = React.useMemo(
    () => getDisplayWeekNumber(semesterRange, week, settings.countReadingWeekInWeekNumber),
    [semesterRange, settings.countReadingWeekInWeekNumber, week],
  );
  const displayMaxWeek = React.useMemo(
    () => getDisplayMaxWeek(semesterRange, maxWeek, settings.countReadingWeekInWeekNumber),
    [maxWeek, semesterRange, settings.countReadingWeekInWeekNumber],
  );
  const shouldShowReadingWeekLabel = React.useMemo(
    () => isReadingWeek(semesterRange, week) && !settings.countReadingWeekInWeekNumber,
    [semesterRange, settings.countReadingWeekInWeekNumber, week],
  );
  const formatWeekLabel = React.useCallback((targetWeek: number) => {
    if (isReadingWeek(semesterRange, targetWeek) && !settings.countReadingWeekInWeekNumber) {
      return 'Reading Week';
    }

    const resolvedWeekNumber = getDisplayWeekNumber(
      semesterRange,
      targetWeek,
      settings.countReadingWeekInWeekNumber,
    ) ?? Math.max(1, targetWeek);

    return `Week ${resolvedWeekNumber}/${displayMaxWeek}`;
  }, [displayMaxWeek, semesterRange, settings.countReadingWeekInWeekNumber]);

  const currentPeriodLabel = viewMode === 'month' ? 'Month' : 'Week';
  const isCurrentPeriod = viewMode === 'month' ? isCurrentMonth : week === currentWeek;

  const handleSaveEvent = React.useCallback(async (eventId: string, patch: CalendarEventPatch) => {
    if (!semesterId) {
      toast.error('Semester context is required to update events.');
      return;
    }

    const targetEvent = eventsById.get(eventId);
    if (!targetEvent) {
      toast.error('Unable to locate event for update.');
      return;
    }

    setOptimisticPatches((previous) => {
      const next = new Map(previous);
      next.set(eventId, {
        ...next.get(eventId),
        ...patch,
      });
      return next;
    });

    try {
      await scheduleService.updateCourseEvent(targetEvent.courseId, eventId, {
        skip: patch.skip,
        enable: patch.enable,
      });

      skipNextScheduleReloadRef.current = {
        courseId: targetEvent.courseId,
        semesterId,
        reason: 'event-updated',
      };
      timetableEventBus.publish('timetable:schedule-data-changed', {
        source: 'course',
        reason: 'event-updated',
        courseId: targetEvent.courseId,
        semesterId,
      });

      setOptimisticPatches((previous) => {
        const next = new Map(previous);
        next.delete(eventId);
        return next;
      });

      await reload();
    } catch (updateError: any) {
      setOptimisticPatches((previous) => {
        const next = new Map(previous);
        next.delete(eventId);
        return next;
      });
      skipNextScheduleReloadRef.current = null;
      toast.error(updateError?.response?.data?.detail?.message ?? updateError?.message ?? 'Failed to update event.');
      throw updateError;
    }
  }, [eventsById, reload, semesterId]);

  if (!semesterId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
          <CardDescription>Semester context is required.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading && items.length === 0) {
    return <CalendarSkeleton />;
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div
        ref={cardRef}
        className="grid h-[100%] min-h-0 min-w-0 grid-rows-[auto_1fr] gap-3 overflow-hidden rounded-lg bg-card p-3 sm:p-4"
        style={viewportBoundHeight ? { height: `${viewportBoundHeight}px` } : undefined}
      >
        <CalendarToolbar
          week={week}
          maxWeek={maxWeek}
          viewMode={viewMode}
          periodLabel={currentPeriodLabel}
          dateRangeLabel={dateRangeLabel}
          isCurrentPeriod={isCurrentPeriod}
          displayWeekNumber={displayWeekNumber}
          displayMaxWeek={displayMaxWeek}
          isReadingWeek={shouldShowReadingWeekLabel}
          onPrevious={handleNavigatePrevious}
          onNext={handleNavigateNext}
          onToday={handleToday}
          onViewModeChange={handleViewModeChange}
        />

        <div className="min-h-0 min-w-0 overflow-hidden">
          <React.Suspense fallback={<CalendarSkeleton />}>
        <FullCalendarView
          events={calendarEvents}
          week={week}
          maxWeek={maxWeek}
          viewMode={viewMode}
          monthAnchorDate={monthAnchorDate}
              semesterRange={semesterRange}
              dayStartMinutes={settings.dayStartMinutes}
              dayEndMinutes={settings.dayEndMinutes}
              highlightConflicts={settings.highlightConflicts}
              showWeekends={settings.showWeekends}
          isPending={false}
          onWeekChange={handleWeekChange}
          onViewModeChange={handleViewModeChange}
          onEventClick={(event) => {
            if (event.source === 'todo') {
              toast.message('Todo tasks are read-only in calendar for now.');
              return;
            }
            setSelectedEvent(event);
            setIsEventEditorOpen(true);
              }}
            />
          </React.Suspense>
        </div>
      </div>

      <React.Suspense fallback={null}>
        <EventEditor
          open={isEventEditorOpen}
          onOpenChange={setIsEventEditorOpen}
          event={selectedEvent}
          conflictingEvents={selectedEvent ? (conflictGroups.get(conflictOccurrenceKey(selectedEvent) ?? '') ?? []) : []}
          formatWeekLabel={formatWeekLabel}
          onSave={handleSaveEvent}
        />
      </React.Suspense>
    </div>
  );
};
