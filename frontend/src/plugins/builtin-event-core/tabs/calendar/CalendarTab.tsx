// input:  [semester context, calendar-core registry, shared timetable event bus, and calendar subcomponents]
// output: [Calendar tab runtime component with source-driven event rendering and low-coupling extension wiring]
// pos:    [built-in event-core Calendar composition shell that binds registry sources, navigation state, and editing flows]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CalendarEventData, CalendarRefreshSignal } from '@/calendar-core';
import { useCalendarSourceRegistry } from '@/calendar-core';
import type { TabProps } from '@/services/tabRegistry';
import { timetableEventBus, useEventBus } from '../../shared/eventBus';
import { isDateInReadingWeek } from '../../shared/utils';
import { CalendarToolbar } from './CalendarToolbar';
import { CalendarSkeleton } from './components/CalendarSkeleton';
import {
  getCalendarEventColor,
  normalizeCalendarSettings,
} from './settings';
import { ensureBuiltinCalendarSourcesRegistered } from './sources/registerBuiltinCalendarSources';
import { useCalendarEventEditing } from './hooks/useCalendarEventEditing';
import { useCalendarNavigationState } from './hooks/useCalendarNavigationState';
import { useCalendarSources } from './hooks/useCalendarSources';
import { useSemesterCalendarContext } from './hooks/useSemesterCalendarContext';
import { useViewportBoundHeight } from './hooks/useViewportBoundHeight';

ensureBuiltinCalendarSourcesRegistered();

type TimetableRefreshSignal = Extract<CalendarRefreshSignal, { type: 'timetable' }>;

const FullCalendarView = React.lazy(async () => {
  const module = await import('./FullCalendarView');
  return { default: module.FullCalendarView };
});

const EventEditor = React.lazy(async () => {
  const module = await import('./EventEditor');
  return { default: module.EventEditor };
});

const conflictOccurrenceKey = (event: CalendarEventData) => {
  if (!event.conflictGroupId) return null;
  return `${event.week}:${event.dayOfWeek}:${event.conflictGroupId}`;
};

const toRefreshSignal = (payload: {
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
}): TimetableRefreshSignal => ({
  type: 'timetable',
  ...payload,
});

export const CalendarTab: React.FC<TabProps> = ({ semesterId, settings: inputSettings }) => {
  const settings = React.useMemo(() => normalizeCalendarSettings(inputSettings), [inputSettings]);
  const calendarSources = useCalendarSourceRegistry();
  const sourceById = React.useMemo(
    () => new Map(calendarSources.map((source) => [source.id, source])),
    [calendarSources],
  );
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const skipNextRefreshRef = React.useRef<CalendarRefreshSignal | null>(null);
  const sourceErrorSignatureRef = React.useRef('');
  const semesterContext = useSemesterCalendarContext(semesterId);
  const navigation = useCalendarNavigationState({
    semesterId,
    semesterRange: semesterContext.semesterRange,
    maxWeek: semesterContext.maxWeek,
    countReadingWeekInWeekNumber: settings.countReadingWeekInWeekNumber,
    showWeekends: settings.showWeekends,
    weekViewDayCount: settings.weekViewDayCount,
  });
  const sourceContext = React.useMemo(() => {
    if (!semesterId || !semesterContext.isReady) return null;
    return {
      semesterId,
      semesterRange: semesterContext.semesterRange,
      maxWeek: semesterContext.maxWeek,
    };
  }, [semesterContext.isReady, semesterContext.maxWeek, semesterContext.semesterRange, semesterId]);
  const {
    events,
    errorBySourceId,
    isLoading: areSourcesLoading,
    reloadMatchingSources,
  } = useCalendarSources({
    sources: calendarSources,
    context: sourceContext,
  });
  const {
    selectedEvent,
    selectedSourceLabel,
    isEventEditorOpen,
    setIsEventEditorOpen,
    eventsWithOptimisticPatches,
    handleEventClick,
    handleSaveEvent,
  } = useCalendarEventEditing({
    events,
    sources: calendarSources,
    context: sourceContext,
    onSaveSuccess: async (event) => {
      if (!semesterId) return;
      const signal = toRefreshSignal({
        source: 'course',
        reason: 'event-updated',
        courseId: event.courseId,
        semesterId,
      });
      skipNextRefreshRef.current = signal;
      timetableEventBus.publish('timetable:schedule-data-changed', {
        source: 'course',
        reason: 'event-updated',
        courseId: event.courseId,
        semesterId,
      });
      await reloadMatchingSources(signal);
    },
  });
  const viewportBoundHeight = useViewportBoundHeight({
    cardRef,
    dependencyKey: [
      settings.dayStartMinutes,
      settings.dayEndMinutes,
      settings.weekViewDayCount,
      settings.showWeekends,
      navigation.viewMode,
    ].join(':'),
  });

  const calendarEvents = React.useMemo(() => {
    return eventsWithOptimisticPatches
      .map((event) => ({
        ...event,
        color: event.color ?? getCalendarEventColor(settings.eventColors, event.sourceId),
      }))
      .filter((event) => !isDateInReadingWeek(event.start, semesterContext.semesterRange))
      .sort((left, right) => (
        Number(right.allDay) - Number(left.allDay)
        || left.start.getTime() - right.start.getTime()
        || left.title.localeCompare(right.title)
      ));
  }, [eventsWithOptimisticPatches, semesterContext.semesterRange, settings.eventColors]);

  const conflictGroups = React.useMemo(() => {
    const groups = new Map<string, CalendarEventData[]>();

    for (const event of calendarEvents) {
      const groupKey = conflictOccurrenceKey(event);
      if (!groupKey) continue;
      const entries = groups.get(groupKey) ?? [];
      entries.push(event);
      groups.set(groupKey, entries);
    }

    return groups;
  }, [calendarEvents]);

  React.useEffect(() => {
    if (!semesterContext.error) return;
    toast.error(semesterContext.error.message || 'Failed to load calendar context.');
  }, [semesterContext.error]);

  React.useEffect(() => {
    if (errorBySourceId.size === 0) {
      sourceErrorSignatureRef.current = '';
      return;
    }

    const signature = Array.from(errorBySourceId.entries())
      .map(([sourceId, error]) => `${sourceId}:${error.message}`)
      .join('|');
    if (signature === sourceErrorSignatureRef.current) return;
    sourceErrorSignatureRef.current = signature;

    errorBySourceId.forEach((error, sourceId) => {
      const source = sourceById.get(sourceId);
      toast.error(error.message || `Failed to load ${source?.label ?? sourceId}.`);
    });
  }, [errorBySourceId, sourceById]);

  useEventBus('timetable:schedule-data-changed', (payload) => {
    if (!semesterId) return;
    if (!payload.semesterId || payload.semesterId !== semesterId) return;

    const signal = toRefreshSignal(payload);
    const skipSignal = skipNextRefreshRef.current;
    if (skipSignal?.type === 'timetable') {
      if (
        skipSignal.semesterId === signal.semesterId
        && skipSignal.courseId === signal.courseId
        && skipSignal.reason === signal.reason
        && skipSignal.source === signal.source
      ) {
        skipNextRefreshRef.current = null;
        return;
      }
    }

    if (signal.type === 'timetable' && signal.source === 'semester') {
      void semesterContext.reload();
      return;
    }

    void reloadMatchingSources(signal);
  });

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

  if (!semesterContext.isReady && semesterContext.isLoading) {
    return <CalendarSkeleton />;
  }

  if (!semesterContext.isReady && semesterContext.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
          <CardDescription>Failed to load semester calendar context.</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <Button type="button" variant="outline" onClick={() => void semesterContext.reload()}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (areSourcesLoading && calendarEvents.length === 0) {
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
          week={navigation.week}
          maxWeek={semesterContext.maxWeek}
          viewMode={navigation.viewMode}
          periodLabel={navigation.currentPeriodLabel}
          dateRangeLabel={navigation.dateRangeLabel}
          isCurrentPeriod={navigation.isCurrentPeriod}
          displayWeekNumber={navigation.displayWeekNumber}
          displayMaxWeek={navigation.displayMaxWeek}
          isReadingWeek={navigation.shouldShowReadingWeekLabel}
          onPrevious={navigation.handleNavigatePrevious}
          onNext={navigation.handleNavigateNext}
          onToday={navigation.handleToday}
          onViewModeChange={navigation.handleViewModeChange}
        />

        <div className="min-h-0 min-w-0 overflow-hidden">
          <React.Suspense fallback={<CalendarSkeleton />}>
            <FullCalendarView
              events={calendarEvents}
              week={navigation.week}
              maxWeek={semesterContext.maxWeek}
              viewMode={navigation.viewMode}
              monthAnchorDate={navigation.monthAnchorDate}
              weekViewStartDate={navigation.weekViewStartDate}
              semesterRange={semesterContext.semesterRange}
              dayStartMinutes={settings.dayStartMinutes}
              dayEndMinutes={settings.dayEndMinutes}
              weekViewDayCount={settings.weekViewDayCount}
              highlightConflicts={settings.highlightConflicts}
              showWeekends={settings.showWeekends}
              isPending={areSourcesLoading}
              onWeekChange={navigation.handleWeekChange}
              onViewModeChange={navigation.handleViewModeChange}
              onEventClick={handleEventClick}
            />
          </React.Suspense>
        </div>
      </div>

      <React.Suspense fallback={null}>
        <EventEditor
          open={isEventEditorOpen}
          onOpenChange={setIsEventEditorOpen}
          event={selectedEvent}
          sourceLabel={selectedSourceLabel}
          conflictingEvents={selectedEvent ? (conflictGroups.get(conflictOccurrenceKey(selectedEvent) ?? '') ?? []) : []}
          formatWeekLabel={navigation.formatWeekLabel}
          onSave={handleSaveEvent}
        />
      </React.Suspense>
    </div>
  );
};
