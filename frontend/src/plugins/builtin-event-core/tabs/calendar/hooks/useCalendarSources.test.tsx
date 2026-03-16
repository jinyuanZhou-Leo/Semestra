// input:  [calendar source orchestration hook, mock source definitions, and renderHook helpers]
// output: [tests for independent source loading, cache hydration, re-enabled source revalidation, and targeted refresh behavior]
// pos:    [calendar source orchestration regression suite]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CalendarSourceContext, CalendarSourceDefinition } from '@/calendar-core';
import { useCalendarSources } from './useCalendarSources';

const calendarContext: CalendarSourceContext = {
  semesterId: 'semester-1',
  semesterRange: {
    startDate: new Date('2026-03-02T00:00:00'),
    endDate: new Date('2026-06-30T00:00:00'),
    readingWeekStart: null,
    readingWeekEnd: null,
  },
  maxWeek: 16,
  queryRange: {
    start: new Date('2026-03-02T00:00:00'),
    end: new Date('2026-03-23T00:00:00'),
  },
};

const buildEvent = (id: string, sourceId: string) => ({
  id,
  eventId: id,
  sourceId,
  title: id,
  courseId: 'course-1',
  courseName: 'Course 1',
  eventTypeCode: 'LECTURE',
  start: new Date('2026-03-10T09:00:00'),
  end: new Date('2026-03-10T10:00:00'),
  allDay: false,
  week: 2,
  dayOfWeek: 2,
  weekPattern: 'EVERY',
  isRecurring: true,
  startTime: '09:00',
  endTime: '10:00',
  isSkipped: false,
  isConflict: false,
  enable: true,
});

describe('useCalendarSources', () => {
  it('keeps healthy source data when another source fails', async () => {
    const stableSource: CalendarSourceDefinition = {
      id: 'owner:stable',
      ownerId: 'owner',
      label: 'Stable',
      defaultColor: '#3b82f6',
      priority: 100,
      load: vi.fn(async () => [buildEvent('stable-event', 'owner:stable')]),
      shouldRefresh: () => true,
    };
    const failingSource: CalendarSourceDefinition = {
      id: 'owner:failing',
      ownerId: 'owner',
      label: 'Failing',
      defaultColor: '#ef4444',
      priority: 200,
      load: vi.fn(async () => {
        throw new Error('boom');
      }),
      shouldRefresh: () => true,
    };

    const sources = [stableSource, failingSource];
    const { result } = renderHook((props: { sources: CalendarSourceDefinition[] }) => useCalendarSources({
      sources: props.sources,
      context: calendarContext,
    }), {
      initialProps: { sources },
    });

    await waitFor(() => {
      expect(result.current.events).toHaveLength(1);
    });

    expect(result.current.events[0]?.id).toBe('stable-event');
    expect(result.current.errorBySourceId.get('owner:failing')?.message).toBe('boom');
  });

  it('refreshes only sources whose predicates match the signal', async () => {
    const scheduleLoad = vi.fn(async () => [buildEvent('schedule-event', 'owner:schedule')]);
    const todoLoad = vi.fn(async () => [buildEvent('todo-event', 'owner:todo')]);
    const scheduleSource: CalendarSourceDefinition = {
      id: 'owner:schedule',
      ownerId: 'owner',
      label: 'Schedule',
      defaultColor: '#3b82f6',
      priority: 100,
      load: scheduleLoad,
      shouldRefresh: (signal) => signal.type === 'timetable' && signal.reason === 'event-updated',
    };
    const todoSource: CalendarSourceDefinition = {
      id: 'owner:todo',
      ownerId: 'owner',
      label: 'Todo',
      defaultColor: '#10b981',
      priority: 200,
      load: todoLoad,
      shouldRefresh: (signal) => signal.type === 'timetable' && signal.reason === 'events-updated',
    };

    const sources = [scheduleSource, todoSource];
    const { result } = renderHook((props: { sources: CalendarSourceDefinition[] }) => useCalendarSources({
      sources: props.sources,
      context: calendarContext,
    }), {
      initialProps: { sources },
    });

    await waitFor(() => {
      expect(scheduleLoad).toHaveBeenCalledTimes(1);
      expect(todoLoad).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.reloadMatchingSources({
        type: 'timetable',
        source: 'course',
        reason: 'event-updated',
        semesterId: 'semester-1',
        courseId: 'course-1',
      });
    });

    expect(scheduleLoad).toHaveBeenCalledTimes(2);
    expect(todoLoad).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.reloadMatchingSources({
        type: 'timetable',
        source: 'semester',
        reason: 'events-updated',
        semesterId: 'semester-1',
      });
    });

    expect(scheduleLoad).toHaveBeenCalledTimes(2);
    expect(todoLoad).toHaveBeenCalledTimes(2);
  });

  it('hydrates from cached source data without triggering a cold load', async () => {
    const load = vi.fn(async () => [buildEvent('loaded-event', 'owner:cached')]);
    const source: CalendarSourceDefinition = {
      id: 'owner:cached',
      ownerId: 'owner',
      label: 'Cached',
      defaultColor: '#3b82f6',
      priority: 100,
      getCached: () => [buildEvent('cached-event', 'owner:cached')],
      load,
      shouldRefresh: () => true,
    };

    const { result } = renderHook(() => useCalendarSources({
      sources: [source],
      context: calendarContext,
    }));

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0]?.id).toBe('cached-event');
    expect(result.current.isLoading).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it('revalidates a cached source when it is re-enabled later', async () => {
    let resolveLoad: ((events: Array<ReturnType<typeof buildEvent>>) => void) | null = null;
    const source: CalendarSourceDefinition = {
      id: 'owner:toggle',
      ownerId: 'owner',
      label: 'Toggle',
      defaultColor: '#3b82f6',
      priority: 100,
      getCached: () => [buildEvent('cached-event', 'owner:toggle')],
      load: vi.fn(() => new Promise<Array<ReturnType<typeof buildEvent>>>((resolve) => {
        resolveLoad = resolve;
      })),
      shouldRefresh: () => true,
    };

    const { result, rerender } = renderHook((props: { sources: CalendarSourceDefinition[] }) => useCalendarSources({
      sources: props.sources,
      context: calendarContext,
    }), {
      initialProps: { sources: [source] },
    });

    await waitFor(() => {
      expect(result.current.events[0]?.id).toBe('cached-event');
    });
    expect(source.load).not.toHaveBeenCalled();

    rerender({ sources: [] });

    await waitFor(() => {
      expect(result.current.events).toHaveLength(0);
    });

    rerender({ sources: [source] });

    await waitFor(() => {
      expect(result.current.events[0]?.id).toBe('cached-event');
      expect(source.load).toHaveBeenCalledTimes(1);
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveLoad?.([buildEvent('loaded-event', 'owner:toggle')]);
    });

    await waitFor(() => {
      expect(result.current.events[0]?.id).toBe('loaded-event');
    });
  });

  it('renders completed sources before slower sources finish loading', async () => {
    let resolveSlow: ((events: Array<ReturnType<typeof buildEvent>>) => void) | null = null;
    const fastSource: CalendarSourceDefinition = {
      id: 'owner:fast',
      ownerId: 'owner',
      label: 'Fast',
      defaultColor: '#2563eb',
      priority: 100,
      load: vi.fn(async () => [buildEvent('fast-event', 'owner:fast')]),
      shouldRefresh: () => true,
    };
    const slowSource: CalendarSourceDefinition = {
      id: 'owner:slow',
      ownerId: 'owner',
      label: 'Slow',
      defaultColor: '#16a34a',
      priority: 200,
      load: vi.fn(() => new Promise<Array<ReturnType<typeof buildEvent>>>((resolve) => {
        resolveSlow = resolve;
      })),
      shouldRefresh: () => true,
    };

    const { result } = renderHook(() => useCalendarSources({
      sources: [fastSource, slowSource],
      context: calendarContext,
    }));

    await waitFor(() => {
      expect(result.current.events.map((event) => event.id)).toContain('fast-event');
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSlow?.([buildEvent('slow-event', 'owner:slow')]);
    });

    await waitFor(() => {
      expect(result.current.events.map((event) => event.id)).toEqual(expect.arrayContaining(['fast-event', 'slow-event']));
    });
  });
});
