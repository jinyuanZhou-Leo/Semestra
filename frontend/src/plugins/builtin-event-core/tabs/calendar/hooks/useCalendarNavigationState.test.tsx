// input:  [calendar navigation hook, testing-library renderHook helpers, and semester range fixtures]
// output: [regression tests for Calendar month/week navigation stability]
// pos:    [calendar navigation hook test suite covering same-semester anchor preservation]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCalendarNavigationState } from './useCalendarNavigationState';

const buildRange = () => ({
  startDate: new Date('2026-03-02T00:00:00'),
  endDate: new Date('2026-06-30T00:00:00'),
  readingWeekStart: null,
  readingWeekEnd: null,
});

describe('useCalendarNavigationState', () => {
  it('preserves month anchor on same-semester rerenders', () => {
    const { result, rerender } = renderHook((props: {
      semesterId: string;
      semesterRange: ReturnType<typeof buildRange>;
      maxWeek: number;
      showWeekends: boolean;
      weekViewDayCount: number;
    }) => useCalendarNavigationState({
      ...props,
      countReadingWeekInWeekNumber: false,
    }), {
      initialProps: {
        semesterId: 'semester-1',
        semesterRange: buildRange(),
        maxWeek: 16,
        showWeekends: true,
        weekViewDayCount: 5,
      },
    });

    act(() => {
      result.current.handleViewModeChange('month');
    });
    act(() => {
      result.current.handleNavigateNext();
    });

    const anchoredMonth = result.current.monthAnchorDate.getMonth();
    expect(anchoredMonth).toBe(3);

    rerender({
      semesterId: 'semester-1',
      semesterRange: buildRange(),
      maxWeek: 16,
      showWeekends: true,
      weekViewDayCount: 5,
    });

    expect(result.current.monthAnchorDate.getMonth()).toBe(3);
  });

  it('keeps week navigation on full academic weeks regardless of screen day count', () => {
    const { result } = renderHook(() => useCalendarNavigationState({
      semesterId: 'semester-1',
      semesterRange: buildRange(),
      maxWeek: 16,
      countReadingWeekInWeekNumber: false,
      showWeekends: false,
      weekViewDayCount: 3,
    }));

    act(() => {
      result.current.handleWeekChange(1);
    });

    expect(result.current.dateRangeLabel).toBe('Mar 2 - Mar 8');

    act(() => {
      result.current.handleNavigateNext();
    });

    expect(result.current.dateRangeLabel).toBe('Mar 9 - Mar 15');
  });
});
