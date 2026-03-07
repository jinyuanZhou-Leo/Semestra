// input:  [testing-library renderHook helpers, mocked schedule service, and `useScheduleData` hook]
// output: [vitest coverage for event-core schedule hook loading behavior]
// pos:    [Regression tests ensuring the shared schedule hook avoids duplicate post-load refresh cycles]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import scheduleService from '@/services/schedule';
import { useScheduleData } from './useScheduleData';

vi.mock('@/services/schedule', () => ({
  default: {
    getSemesterSchedule: vi.fn(),
  },
}));

const buildScheduleItem = () => ({
  eventId: 'event-1',
  courseId: 'course-1',
  courseName: 'Course 1',
  eventTypeCode: 'LECTURE',
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '10:00',
  enable: true,
  skip: false,
  isConflict: false,
  week: 1,
});

describe('useScheduleData', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not enter a refresh cycle immediately after the initial successful load', async () => {
    const getSemesterSchedule = vi.mocked(scheduleService.getSemesterSchedule);
    getSemesterSchedule.mockResolvedValue({
      week: 1,
      maxWeek: 4,
      items: [buildScheduleItem()],
      warnings: [],
    });

    const transitions: Array<{ isLoading: boolean; isRefreshing: boolean; itemCount: number }> = [];

    const { result } = renderHook(() => {
      const value = useScheduleData({
        semesterId: 'semester-1',
        mode: 'single-week',
        week: 1,
        enabled: true,
        withConflicts: true,
      });

      transitions.push({
        isLoading: value.isLoading,
        isRefreshing: value.isRefreshing,
        itemCount: value.items.length,
      });

      return value;
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
      expect(result.current.isLoading).toBe(false);
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getSemesterSchedule).toHaveBeenCalledTimes(1);
    expect(
      transitions.some((state) => state.isRefreshing && state.itemCount > 0),
    ).toBe(false);
  });
});
