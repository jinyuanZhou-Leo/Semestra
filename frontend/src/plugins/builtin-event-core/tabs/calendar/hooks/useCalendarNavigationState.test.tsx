// input:  [calendar navigation hook, plugin runtime instance provider, testing-library renderHook helpers, and semester range fixtures]
// output: [regression tests for Calendar month/week navigation stability and persisted UI state]
// pos:    [calendar navigation hook test suite covering same-semester anchor preservation and remount restoration]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginRuntimeInstanceProvider, resetPluginUiStateCacheForTests } from '@/plugin-system';
import { useCalendarNavigationState } from './useCalendarNavigationState';

const buildRange = () => ({
  startDate: new Date('2026-03-02T00:00:00'),
  endDate: new Date('2026-06-30T00:00:00'),
  readingWeekStart: null,
  readingWeekEnd: null,
});

describe('useCalendarNavigationState', () => {
  beforeEach(() => {
    resetPluginUiStateCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <PluginRuntimeInstanceProvider
      value={{
        workspaceKind: 'semester',
        workspaceId: 'semester-1',
        slotKind: 'tab',
        slotId: 'calendar-tab',
        pluginType: 'builtin-event-core.calendar',
      }}
    >
      {children}
    </PluginRuntimeInstanceProvider>
  );

  it('restores week and month navigation state after remount', () => {
    const { result, unmount } = renderHook(() => useCalendarNavigationState({
      semesterId: 'semester-1',
      semesterRange: buildRange(),
      maxWeek: 16,
      countReadingWeekInWeekNumber: false,
      showWeekends: true,
      weekViewDayCount: 5,
    }), { wrapper });

    act(() => {
      result.current.handleViewModeChange('month');
      result.current.handleNavigateNext();
    });

    const storedMonth = result.current.monthAnchorDate.getMonth();
    const storedWeek = result.current.week;
    const storedViewMode = result.current.viewMode;

    unmount();

    const remounted = renderHook(() => useCalendarNavigationState({
      semesterId: 'semester-1',
      semesterRange: buildRange(),
      maxWeek: 16,
      countReadingWeekInWeekNumber: false,
      showWeekends: true,
      weekViewDayCount: 5,
    }), { wrapper });

    expect(remounted.result.current.monthAnchorDate.getMonth()).toBe(storedMonth);
    expect(remounted.result.current.week).toBe(storedWeek);
    expect(remounted.result.current.viewMode).toBe(storedViewMode);
  });

  it('preserves month anchor on same-semester rerenders', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-03T12:00:00'));

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
      wrapper,
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
    }), { wrapper });

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
