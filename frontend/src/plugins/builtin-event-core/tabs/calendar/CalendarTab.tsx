import React from 'react';
import { toast } from 'sonner';
import api from '@/services/api';
import scheduleService from '@/services/schedule';
import type { TabProps } from '@/services/tabRegistry';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ALL_FILTER_VALUE,
  CALENDAR_DEFAULT_VIEW_MODE,
  CALENDAR_EVENT_DEFAULT_COLORS,
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
  buildCalendarEvents,
  resolveSemesterDateRange,
} from '../../shared/utils';
import { CalendarToolbar } from './CalendarToolbar';
import { CalendarSkeleton } from './components/CalendarSkeleton';

const FullCalendarView = React.lazy(async () => {
  const module = await import('./FullCalendarView');
  return { default: module.FullCalendarView };
});

const EventEditor = React.lazy(async () => {
  const module = await import('./EventEditor');
  return { default: module.EventEditor };
});

const FALLBACK_RANGE: SemesterDateRange = resolveSemesterDateRange(undefined, undefined, 16);

const normalizeCalendarSettings = (value: any): CalendarSettingsState => {
  const source = value && typeof value === 'object' ? value : {};
  const sourceFilters = source.filters && typeof source.filters === 'object' ? source.filters : {};
  const sourceColors = source.eventColors && typeof source.eventColors === 'object' ? source.eventColors : {};

  return {
    skippedDisplay: source.skippedDisplay === 'hidden' ? 'hidden' : 'grayed',
    eventColors: {
      schedule: typeof sourceColors.schedule === 'string' ? sourceColors.schedule : CALENDAR_EVENT_DEFAULT_COLORS.schedule,
      todo: typeof sourceColors.todo === 'string' ? sourceColors.todo : CALENDAR_EVENT_DEFAULT_COLORS.todo,
      custom: typeof sourceColors.custom === 'string' ? sourceColors.custom : CALENDAR_EVENT_DEFAULT_COLORS.custom,
    },
    filters: {
      courseFilter: typeof sourceFilters.courseFilter === 'string' ? sourceFilters.courseFilter : ALL_FILTER_VALUE,
      typeFilter: typeof sourceFilters.typeFilter === 'string' ? sourceFilters.typeFilter : ALL_FILTER_VALUE,
      showConflictsOnly: Boolean(sourceFilters.showConflictsOnly),
    },
  };
};

export const CalendarTab: React.FC<TabProps> = ({ semesterId, settings: inputSettings }) => {
  const [week, setWeek] = React.useState(DEFAULT_WEEK);
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>(CALENDAR_DEFAULT_VIEW_MODE as CalendarViewMode);
  const [settings, setSettings] = React.useState<CalendarSettingsState>(() => normalizeCalendarSettings(inputSettings));
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEventData | null>(null);
  const [isEventEditorOpen, setIsEventEditorOpen] = React.useState(false);
  const [semesterRange, setSemesterRange] = React.useState<SemesterDateRange>(FALLBACK_RANGE);
  const [optimisticPatches, setOptimisticPatches] = React.useState<Map<string, CalendarEventPatch>>(new Map());
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setSettings(normalizeCalendarSettings(inputSettings));
  }, [inputSettings]);

  const {
    items,
    maxWeek,
    isLoading,
    isRefreshing,
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
    if (!semesterId) return;

    let isActive = true;

    api.getSemester(semesterId)
      .then((semester) => {
        if (!isActive) return;
        setSemesterRange(resolveSemesterDateRange(semester.start_date, semester.end_date, Math.max(1, maxWeek)));
      })
      .catch(() => {
        if (!isActive) return;
        setSemesterRange(resolveSemesterDateRange(undefined, undefined, Math.max(1, maxWeek)));
      });

    return () => {
      isActive = false;
    };
  }, [semesterId, maxWeek]);

  React.useEffect(() => {
    if (!error) return;
    toast.error(error.message || 'Failed to load calendar schedule.');
  }, [error]);

  useEventBus('timetable:schedule-data-changed', (payload) => {
    if (payload.source !== 'course' && payload.source !== 'semester') return;
    void reload();
  }, [reload]);

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
    return buildCalendarEvents(
      itemsWithPatches,
      semesterRange.startDate,
      settings.eventColors,
      settings.skippedDisplay,
      settings.filters,
    );
  }, [itemsWithPatches, semesterRange.startDate, settings]);

  const eventsById = React.useMemo(() => {
    const map = new Map<string, CalendarEventData>();
    for (const event of calendarEvents) {
      if (!map.has(event.eventId)) {
        map.set(event.eventId, event);
      }
    }
    return map;
  }, [calendarEvents]);

  const eventsForWeek = React.useMemo(() => {
    return calendarEvents.filter((event) => event.week === week);
  }, [calendarEvents, week]);

  const handleWeekChange = React.useCallback((targetWeek: number) => {
    const boundedWeek = Math.max(1, Math.min(Math.max(1, maxWeek), targetWeek));
    startTransition(() => {
      setWeek(boundedWeek);
    });
  }, [maxWeek]);

  const handleSaveEvent = React.useCallback(async (eventId: string, patch: CalendarEventPatch) => {
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
    <div className="flex h-full flex-col gap-4 py-4 sm:py-6">
      <div className="rounded-lg border bg-card p-4">
        <CalendarToolbar
          week={week}
          maxWeek={maxWeek}
          visibleCount={viewMode === 'week' ? eventsForWeek.length : calendarEvents.length}
          totalCount={calendarEvents.length}
          viewMode={viewMode}
          isRefreshing={isRefreshing}
          isPending={isPending}
          onViewModeChange={setViewMode}
          onReload={() => void reload()}
        />
      </div>

      <div className="min-h-[460px] rounded-lg border bg-card p-3 sm:p-4">
        <React.Suspense fallback={<CalendarSkeleton />}>
          <FullCalendarView
            events={calendarEvents}
            week={week}
            maxWeek={maxWeek}
            viewMode={viewMode}
            semesterRange={semesterRange}
            isPending={isPending}
            onWeekChange={handleWeekChange}
            onEventClick={(event) => {
              setSelectedEvent(event);
              setIsEventEditorOpen(true);
            }}
          />
        </React.Suspense>
      </div>

      <React.Suspense fallback={null}>
        <EventEditor
          open={isEventEditorOpen}
          onOpenChange={setIsEventEditorOpen}
          event={selectedEvent}
          onSave={handleSaveEvent}
        />
      </React.Suspense>
    </div>
  );
};
