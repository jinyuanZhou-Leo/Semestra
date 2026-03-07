// input:  [FullCalendarView renderer, calendar event fixtures, ResizeObserver shim, and testing-library helpers]
// output: [test suite validating month-view overflow reveal actions]
// pos:    [Calendar regression tests for hidden-event reveal behavior in month view]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { FullCalendarView } from './FullCalendarView';
import type { CalendarEventData } from '../../shared/types';

beforeAll(() => {
    (globalThis as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = class ResizeObserver {
        observe() { }
        unobserve() { }
        disconnect() { }
    } as typeof ResizeObserver;
});

const buildEvent = (id: string, hour: number): CalendarEventData => ({
    id,
    eventId: id,
    source: 'schedule',
    title: `Event ${id}`,
    courseId: 'course-1',
    courseName: `Course ${id}`,
    eventTypeCode: 'LECTURE',
    start: new Date(`2026-03-10T${String(hour).padStart(2, '0')}:00:00`),
    end: new Date(`2026-03-10T${String(hour + 1).padStart(2, '0')}:00:00`),
    week: 2,
    dayOfWeek: 2,
    startTime: `${String(hour).padStart(2, '0')}:00`,
    endTime: `${String(hour + 1).padStart(2, '0')}:00`,
    color: '#2563eb',
    isSkipped: false,
    isConflict: false,
    conflictGroupId: null,
    enable: true,
    note: '',
});

describe('FullCalendarView month overflow', () => {
    it('reveals a view-all action for days with hidden events', () => {
        const onWeekChange = vi.fn();
        const onViewModeChange = vi.fn();

        render(
            <FullCalendarView
                events={[buildEvent('a', 9), buildEvent('b', 10), buildEvent('c', 11), buildEvent('d', 12)]}
                week={1}
                maxWeek={16}
                viewMode="month"
                semesterRange={{
                    startDate: new Date('2026-03-02T00:00:00'),
                    endDate: new Date('2026-06-30T00:00:00'),
                }}
                dayStartMinutes={8 * 60}
                dayEndMinutes={18 * 60}
                highlightConflicts={false}
                showWeekends
                isPending={false}
                onWeekChange={onWeekChange}
                onViewModeChange={onViewModeChange}
                onEventClick={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /View 1 more events on/i }));

        expect(onViewModeChange).toHaveBeenCalledWith('week');
        expect(onWeekChange).toHaveBeenCalledTimes(0);
    });

    it('surfaces conflict text in month view event rows', () => {
        render(
            <FullCalendarView
                events={[{ ...buildEvent('conflict', 9), isConflict: true, conflictGroupId: 'conflict-1' }]}
                week={1}
                maxWeek={16}
                viewMode="month"
                semesterRange={{
                    startDate: new Date('2026-03-02T00:00:00'),
                    endDate: new Date('2026-06-30T00:00:00'),
                }}
                dayStartMinutes={8 * 60}
                dayEndMinutes={18 * 60}
                highlightConflicts
                showWeekends
                isPending={false}
                onWeekChange={vi.fn()}
                onViewModeChange={vi.fn()}
                onEventClick={vi.fn()}
            />
        );

        expect(screen.getByRole('button', { name: /conflict detected/i })).toBeInTheDocument();
        expect(screen.getByText(/Conflict · 09:00 Course conflict/i)).toBeInTheDocument();
    });

    it('lays out conflicting week-view events side by side instead of full-width overlap', () => {
        render(
            <FullCalendarView
                events={[
                    { ...buildEvent('conflict-a', 9), isConflict: true, conflictGroupId: 'conflict-1' },
                    { ...buildEvent('conflict-b', 9), isConflict: true, conflictGroupId: 'conflict-1', courseId: 'course-2', courseName: 'Course B' },
                ]}
                week={2}
                maxWeek={16}
                viewMode="week"
                semesterRange={{
                    startDate: new Date('2026-03-02T00:00:00'),
                    endDate: new Date('2026-06-30T00:00:00'),
                }}
                dayStartMinutes={8 * 60}
                dayEndMinutes={18 * 60}
                highlightConflicts
                showWeekends
                isPending={false}
                onWeekChange={vi.fn()}
                onViewModeChange={vi.fn()}
                onEventClick={vi.fn()}
            />
        );

        const conflictButtons = screen.getAllByRole('button', { name: /conflict detected/i });
        expect(conflictButtons).toHaveLength(2);
        expect(conflictButtons[0]).toHaveStyle({ width: 'calc(50% - 8px)' });
        expect(conflictButtons[1]).toHaveStyle({ width: 'calc(50% - 8px)' });
    });
});
