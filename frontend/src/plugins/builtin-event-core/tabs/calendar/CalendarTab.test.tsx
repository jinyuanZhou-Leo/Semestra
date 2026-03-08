// input:  [CalendarTab runtime, standalone calendar registry, mocked API/schedule services, and child-component test doubles]
// output: [integration tests for CalendarTab source registration and orchestration wiring]
// pos:    [CalendarTab regression suite covering external source registration through calendar-core]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CalendarSourceDefinition } from '@/calendar-core';
import { registerCalendarSources } from '@/calendar-core';
import scheduleService from '@/services/schedule';
import api from '@/services/api';
import { CalendarTab } from './CalendarTab';

vi.mock('@/services/schedule', () => ({
  default: {
    getSemesterSchedule: vi.fn(),
    updateCourseEvent: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  default: {
    getSemester: vi.fn(),
    getCourse: vi.fn(),
  },
}));

vi.mock('./FullCalendarView', () => ({
  FullCalendarView: ({ events }: { events: Array<{ title: string }> }) => (
    <div data-testid="mock-fullcalendar">
      {events.map((event) => <span key={event.title}>{event.title}</span>)}
    </div>
  ),
}));

vi.mock('./EventEditor', () => ({
  EventEditor: () => null,
}));

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
});

describe('CalendarTab', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders events from externally registered calendar sources', async () => {
    const externalSource: CalendarSourceDefinition = {
      id: 'test-owner:external',
      ownerId: 'test-owner',
      label: 'External',
      defaultColor: '#f97316',
      priority: 50,
      load: vi.fn(async () => [{
        id: 'external-event',
        eventId: 'external-event',
        sourceId: 'test-owner:external',
        title: 'External milestone',
        courseId: 'course-1',
        courseName: 'Course 1',
        eventTypeCode: 'MILESTONE',
        start: new Date('2026-03-10T09:00:00'),
        end: new Date('2026-03-10T10:00:00'),
        allDay: false,
        week: 2,
        dayOfWeek: 2,
        weekPattern: null,
        isRecurring: false,
        startTime: '09:00',
        endTime: '10:00',
        isSkipped: false,
        isConflict: false,
        conflictGroupId: null,
        enable: true,
        note: null,
      }]),
      shouldRefresh: () => true,
    };

    const unregister = registerCalendarSources('test-owner', [externalSource]);

    try {
      vi.mocked(api.getSemester).mockResolvedValue({
        id: 'semester-1',
        name: 'Semester 1',
        average_scaled: 0,
        average_percentage: 0,
        start_date: '2026-03-02',
        end_date: '2026-06-30',
        reading_week_start: null,
        reading_week_end: null,
        tabs: [],
        courses: [],
      } as any);
      vi.mocked(scheduleService.getSemesterSchedule).mockResolvedValue({
        week: 1,
        maxWeek: 16,
        items: [],
        warnings: [],
      });

      render(
        <CalendarTab
          tabId="calendar-1"
          semesterId="semester-1"
          settings={{}}
          updateSettings={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('External milestone')).toBeInTheDocument();
      });
    } finally {
      act(() => {
        unregister();
      });
    }
  });
});
