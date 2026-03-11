// input:  [FullCalendarView renderer, calendar event fixtures, DOM observer shims, and testing-library helpers]
// output: [test suite validating FullCalendar-backed overflow, Apple Calendar-style schedule metadata, DST-safe week sync, conflict labels, and event click wiring]
// pos:    [Calendar regression tests for the builtin-event-core FullCalendar adapter]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { FullCalendarView } from './FullCalendarView';
import type { CalendarEventData } from '../../shared/types';
import { BUILTIN_CALENDAR_SOURCE_SCHEDULE, SLOT_LOCATION_NOTE_PREFIX } from '../../shared/constants';

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

const buildEvent = (
  id: string,
  hour: number,
  options?: {
    durationHours?: number;
    note?: string;
    title?: string;
    allDay?: boolean;
  },
): CalendarEventData => ({
  id,
  eventId: id,
  sourceId: BUILTIN_CALENDAR_SOURCE_SCHEDULE,
  title: options?.title ?? `Event ${id}`,
  courseId: 'course-1',
  courseName: `Course ${id}`,
  eventTypeCode: 'LECTURE',
  start: new Date(`2026-03-10T${String(hour).padStart(2, '0')}:00:00`),
  end: new Date(`2026-03-10T${String(hour + (options?.durationHours ?? 1)).padStart(2, '0')}:00:00`),
  allDay: options?.allDay ?? false,
  week: 2,
  dayOfWeek: 2,
  weekPattern: 'EVERY',
  isRecurring: true,
  startTime: `${String(hour).padStart(2, '0')}:00`,
  endTime: `${String(hour + (options?.durationHours ?? 1)).padStart(2, '0')}:00`,
  color: '#2563eb',
  isSkipped: false,
  isConflict: false,
  conflictGroupId: null,
  enable: true,
  note: options?.note ?? '',
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
        weekViewStartDate={new Date('2026-03-02T00:00:00')}
        semesterRange={{
          startDate: new Date('2026-03-02T00:00:00'),
          endDate: new Date('2026-06-30T00:00:00'),
          readingWeekStart: null,
          readingWeekEnd: null,
        }}
        dayStartMinutes={8 * 60}
        dayEndMinutes={18 * 60}
        weekViewDayCount={5}
        highlightConflicts={false}
        showWeekends
        isPending={false}
        onWeekChange={onWeekChange}
        onViewModeChange={onViewModeChange}
        onEventClick={vi.fn()}
      />,
    );

    const moreLink = await screen.findByText(/1 more/i);
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
        weekViewStartDate={new Date('2026-03-02T00:00:00')}
        semesterRange={{
          startDate: new Date('2026-03-02T00:00:00'),
          endDate: new Date('2026-06-30T00:00:00'),
          readingWeekStart: null,
          readingWeekEnd: null,
        }}
        dayStartMinutes={8 * 60}
        dayEndMinutes={18 * 60}
        weekViewDayCount={5}
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
        weekViewStartDate={new Date('2026-03-09T00:00:00')}
        semesterRange={{
          startDate: new Date('2026-03-02T00:00:00'),
          endDate: new Date('2026-06-30T00:00:00'),
          readingWeekStart: null,
          readingWeekEnd: null,
        }}
        dayStartMinutes={8 * 60}
        dayEndMinutes={18 * 60}
        weekViewDayCount={5}
        highlightConflicts={false}
        showWeekends
        isPending={false}
        onWeekChange={vi.fn()}
        onViewModeChange={vi.fn()}
        onEventClick={onEventClick}
      />,
    );

    fireEvent.click(await screen.findByLabelText(/09:00.*Course click/i));

    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onEventClick.mock.calls[0]?.[0]).toMatchObject({
      eventId: 'click',
      courseName: 'Course click',
    });
  });

  it('does not snap a DST-crossing week back to the previous week on render', async () => {
    const onWeekChange = vi.fn();

    render(
      <FullCalendarView
        events={[buildEvent('dst', 9)]}
        week={2}
        maxWeek={18}
        viewMode="week"
        monthAnchorDate={new Date('2026-03-09T00:00:00')}
        weekViewStartDate={new Date('2026-03-09T00:00:00')}
        semesterRange={{
          startDate: new Date('2026-03-02T00:00:00'),
          endDate: new Date('2026-06-30T00:00:00'),
          readingWeekStart: null,
          readingWeekEnd: null,
        }}
        dayStartMinutes={8 * 60}
        dayEndMinutes={18 * 60}
        weekViewDayCount={5}
        highlightConflicts={false}
        showWeekends
        isPending={false}
        onWeekChange={onWeekChange}
        onViewModeChange={vi.fn()}
        onEventClick={vi.fn()}
      />,
    );

    expect(await screen.findByText('Mon')).toBeInTheDocument();
    expect(onWeekChange).not.toHaveBeenCalled();
  });

  it('renders title, location, and time like the schedule reference in week view', async () => {
    render(
      <FullCalendarView
        events={[buildEvent('recurring', 9, {
          durationHours: 2,
          title: 'ECE110H1 TUT0106',
          note: `${SLOT_LOCATION_NOTE_PREFIX}GB 303`,
        })]}
        week={2}
        maxWeek={16}
        viewMode="week"
        monthAnchorDate={new Date('2026-03-09T00:00:00')}
        weekViewStartDate={new Date('2026-03-09T00:00:00')}
        semesterRange={{
          startDate: new Date('2026-03-02T00:00:00'),
          endDate: new Date('2026-06-30T00:00:00'),
          readingWeekStart: null,
          readingWeekEnd: null,
        }}
        dayStartMinutes={8 * 60}
        dayEndMinutes={18 * 60}
        weekViewDayCount={5}
        highlightConflicts={false}
        showWeekends
        isPending={false}
        onWeekChange={vi.fn()}
        onViewModeChange={vi.fn()}
        onEventClick={vi.fn()}
      />,
    );

    expect(await screen.findByText('ECE110H1 TUT0106')).toBeInTheDocument();
    expect(screen.getByText('GB 303')).toBeInTheDocument();
    expect(screen.getByText('09:00-11:00')).toBeInTheDocument();
    expect(screen.getByLabelText('Recurring event')).toBeInTheDocument();
  });

  it('keeps location visible for shorter week-view events', async () => {
    render(
      <FullCalendarView
        events={[buildEvent('short-location', 9, {
          durationHours: 1,
          title: 'ECE110H1 LEC0103',
          note: `${SLOT_LOCATION_NOTE_PREFIX}GB 341`,
        })]}
        week={2}
        maxWeek={16}
        viewMode="week"
        monthAnchorDate={new Date('2026-03-09T00:00:00')}
        weekViewStartDate={new Date('2026-03-09T00:00:00')}
        semesterRange={{
          startDate: new Date('2026-03-02T00:00:00'),
          endDate: new Date('2026-06-30T00:00:00'),
          readingWeekStart: null,
          readingWeekEnd: null,
        }}
        dayStartMinutes={8 * 60}
        dayEndMinutes={18 * 60}
        weekViewDayCount={5}
        highlightConflicts={false}
        showWeekends
        isPending={false}
        onWeekChange={vi.fn()}
        onViewModeChange={vi.fn()}
        onEventClick={vi.fn()}
      />,
    );

    expect(await screen.findByText('ECE110H1 LEC0103')).toBeInTheDocument();
    expect(screen.getByText('GB 341')).toBeInTheDocument();
  });

  it('renders compact month chips with the event time on the trailing edge', async () => {
    render(
      <FullCalendarView
        events={[buildEvent('month-chip', 9, { title: 'ECE110 Assignment 4' })]}
        week={2}
        maxWeek={16}
        viewMode="month"
        monthAnchorDate={new Date('2026-03-09T00:00:00')}
        weekViewStartDate={new Date('2026-03-09T00:00:00')}
        semesterRange={{
          startDate: new Date('2026-03-02T00:00:00'),
          endDate: new Date('2026-06-30T00:00:00'),
          readingWeekStart: null,
          readingWeekEnd: null,
        }}
        dayStartMinutes={8 * 60}
        dayEndMinutes={18 * 60}
        weekViewDayCount={5}
        highlightConflicts={false}
        showWeekends
        isPending={false}
        onWeekChange={vi.fn()}
        onViewModeChange={vi.fn()}
        onEventClick={vi.fn()}
      />,
    );

    const chipLabel = await screen.findByText('ECE110 Assignment 4');
    const chip = chipLabel.closest('.fc-event');

    expect(chipLabel).toBeInTheDocument();
    expect(chip?.textContent?.replace('ECE110 Assignment 4', '').trim().length).toBeGreaterThan(0);
  });

  it('keeps all-day month events as filled pills', async () => {
    render(
      <FullCalendarView
        events={[buildEvent('all-day-pill', 9, { title: 'Assignment 3 [ECE110H1]', allDay: true })]}
        week={2}
        maxWeek={16}
        viewMode="month"
        monthAnchorDate={new Date('2026-03-09T00:00:00')}
        weekViewStartDate={new Date('2026-03-09T00:00:00')}
        semesterRange={{
          startDate: new Date('2026-03-02T00:00:00'),
          endDate: new Date('2026-06-30T00:00:00'),
          readingWeekStart: null,
          readingWeekEnd: null,
        }}
        dayStartMinutes={8 * 60}
        dayEndMinutes={18 * 60}
        weekViewDayCount={5}
        highlightConflicts={false}
        showWeekends
        isPending={false}
        onWeekChange={vi.fn()}
        onViewModeChange={vi.fn()}
        onEventClick={vi.fn()}
      />,
    );

    const pillLabel = await screen.findByText('Assignment 3 [ECE110H1]');
    expect(pillLabel.closest('.fc-daygrid-event')?.getAttribute('data-semestra-all-day')).toBe('true');
  });

  it('keeps the full week and widens the week grid for horizontal scrolling', async () => {
    const { container } = render(
      <FullCalendarView
        events={[buildEvent('window', 9)]}
        week={1}
        maxWeek={16}
        viewMode="week"
        monthAnchorDate={new Date('2026-03-02T00:00:00')}
        weekViewStartDate={new Date('2026-03-02T00:00:00')}
        semesterRange={{
          startDate: new Date('2026-03-02T00:00:00'),
          endDate: new Date('2026-06-30T00:00:00'),
          readingWeekStart: null,
          readingWeekEnd: null,
        }}
        dayStartMinutes={8 * 60}
        dayEndMinutes={18 * 60}
        weekViewDayCount={3}
        highlightConflicts={false}
        showWeekends={false}
        isPending={false}
        onWeekChange={vi.fn()}
        onViewModeChange={vi.fn()}
        onEventClick={vi.fn()}
      />,
    );

    expect(await screen.findByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="calendar-week-scroll-frame"]')).toHaveStyle({ minWidth: '166.66666666666669%' });
  });
});
