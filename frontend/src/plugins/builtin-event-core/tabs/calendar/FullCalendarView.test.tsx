// input:  [FullCalendarView renderer, calendar event fixtures, DOM observer shims, and testing-library helpers]
// output: [test suite validating FullCalendar-backed month overflow, conflict labels, and event click wiring]
// pos:    [Calendar regression tests for the builtin-event-core FullCalendar adapter]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { FullCalendarView } from './FullCalendarView';
import type { CalendarEventData } from '../../shared/types';
import { BUILTIN_CALENDAR_SOURCE_SCHEDULE } from '../../shared/constants';

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const buildEvent = (id: string, hour: number): CalendarEventData => ({
  id,
  eventId: id,
  sourceId: BUILTIN_CALENDAR_SOURCE_SCHEDULE,
  title: `Event ${id}`,
  courseId: 'course-1',
  courseName: `Course ${id}`,
  eventTypeCode: 'LECTURE',
  start: new Date(`2026-03-10T${String(hour).padStart(2, '0')}:00:00`),
  end: new Date(`2026-03-10T${String(hour + 1).padStart(2, '0')}:00:00`),
  allDay: false,
  week: 2,
  dayOfWeek: 2,
  weekPattern: 'EVERY',
  isRecurring: true,
  startTime: `${String(hour).padStart(2, '0')}:00`,
  endTime: `${String(hour + 1).padStart(2, '0')}:00`,
  color: '#2563eb',
  isSkipped: false,
  isConflict: false,
  conflictGroupId: null,
  enable: true,
  note: '',
});

describe('FullCalendarView', () => {
  it('switches from month overflow into the clicked week', async () => {
    const onWeekChange = vi.fn();
    const onViewModeChange = vi.fn();

    render(
      <FullCalendarView
        events={[buildEvent('a', 9), buildEvent('b', 10), buildEvent('c', 11), buildEvent('d', 12)]}
        week={1}
        maxWeek={16}
        viewMode="month"
        monthAnchorDate={new Date('2026-03-02T00:00:00')}
        semesterRange={{
          startDate: new Date('2026-03-02T00:00:00'),
          endDate: new Date('2026-06-30T00:00:00'),
          readingWeekStart: null,
          readingWeekEnd: null,
        }}
        dayStartMinutes={8 * 60}
        dayEndMinutes={18 * 60}
        highlightConflicts={false}
        showWeekends
        isPending={false}
        onWeekChange={onWeekChange}
        onViewModeChange={onViewModeChange}
        onEventClick={vi.fn()}
      />,
    );

    const moreLink = await screen.findByText(/View 1 more/i);
    fireEvent.click(moreLink);

    await waitFor(() => {
      expect(onViewModeChange).toHaveBeenCalledWith('week');
      expect(onWeekChange).toHaveBeenCalledWith(2);
    });
  });

  it('renders conflict labels in month view event chips', async () => {
    render(
      <FullCalendarView
        events={[{ ...buildEvent('conflict', 9), isConflict: true, conflictGroupId: 'conflict-1' }]}
        week={1}
        maxWeek={16}
        viewMode="month"
        monthAnchorDate={new Date('2026-03-02T00:00:00')}
        semesterRange={{
          startDate: new Date('2026-03-02T00:00:00'),
          endDate: new Date('2026-06-30T00:00:00'),
          readingWeekStart: null,
          readingWeekEnd: null,
        }}
        dayStartMinutes={8 * 60}
        dayEndMinutes={18 * 60}
        highlightConflicts
        showWeekends
        isPending={false}
        onWeekChange={vi.fn()}
        onViewModeChange={vi.fn()}
        onEventClick={vi.fn()}
      />,
    );

    const conflictLabel = await screen.findByText(/Conflict · Event conflict/i);
    expect(conflictLabel).toBeInTheDocument();
    expect(conflictLabel.closest('.fc-event')?.getAttribute('style')).toContain('var(--semestra-calendar-conflict-surface)');
    expect(conflictLabel.closest('.fc-event')?.getAttribute('style')).toContain('var(--semestra-calendar-conflict-border)');
  });

  it('passes the source calendar event to the click handler in week view', async () => {
    const onEventClick = vi.fn();

    render(
      <FullCalendarView
        events={[buildEvent('click', 9)]}
        week={2}
        maxWeek={16}
        viewMode="week"
        monthAnchorDate={new Date('2026-03-09T00:00:00')}
        semesterRange={{
          startDate: new Date('2026-03-02T00:00:00'),
          endDate: new Date('2026-06-30T00:00:00'),
          readingWeekStart: null,
          readingWeekEnd: null,
        }}
        dayStartMinutes={8 * 60}
        dayEndMinutes={18 * 60}
        highlightConflicts={false}
        showWeekends
        isPending={false}
        onWeekChange={vi.fn()}
        onViewModeChange={vi.fn()}
        onEventClick={onEventClick}
      />,
    );

    fireEvent.click(await screen.findByLabelText(/09:00 Course click/i));

    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onEventClick.mock.calls[0]?.[0]).toMatchObject({
      eventId: 'click',
      courseName: 'Course click',
    });
  });

  it('renders event type on its own line and shows recurring icon in week view', async () => {
    render(
      <FullCalendarView
        events={[buildEvent('recurring', 9)]}
        week={2}
        maxWeek={16}
        viewMode="week"
        monthAnchorDate={new Date('2026-03-09T00:00:00')}
        semesterRange={{
          startDate: new Date('2026-03-02T00:00:00'),
          endDate: new Date('2026-06-30T00:00:00'),
          readingWeekStart: null,
          readingWeekEnd: null,
        }}
        dayStartMinutes={8 * 60}
        dayEndMinutes={18 * 60}
        highlightConflicts={false}
        showWeekends
        isPending={false}
        onWeekChange={vi.fn()}
        onViewModeChange={vi.fn()}
        onEventClick={vi.fn()}
      />,
    );

    expect(await screen.findByText('LECTURE')).toBeInTheDocument();
    expect(screen.getByLabelText('Recurring event')).toBeInTheDocument();
    expect(screen.queryByText(/9:00 - 10:00/i)).not.toBeInTheDocument();
  });
});
