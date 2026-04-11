// input:  [Vitest assertions, builtin gradebook calendar source, and mocked semester/gradebook API responses]
// output: [tests covering gradebook assessment-to-calendar mapping and targeted refresh behavior]
// pos:    [calendar source regression suite for due-date-driven gradebook overlays]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/services/api';
import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/services/queryKeys';
import scheduleService from '@/services/schedule';
import { createGradebookCalendarSource } from './gradebookSource';
import { BUILTIN_CALENDAR_SOURCE_GRADEBOOK } from '../../../shared/constants';

vi.mock('@/services/api', () => ({
  default: {
    getSemesterGradebook: vi.fn(),
  },
}));

describe('createGradebookCalendarSource', () => {
  const services = { api, queryClient, queryKeys, scheduleService };
  const source = createGradebookCalendarSource(services);

  const context = {
    scopeId: 'semester-1',
    scopeRange: {
      startDate: new Date('2026-01-05T00:00:00'),
      endDate: new Date('2026-04-30T00:00:00'),
    },
    maxPeriod: 16,
    queryRange: {
      start: new Date('2026-01-05T00:00:00'),
      end: new Date('2026-05-07T00:00:00'),
    },
  };

  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('maps only assessments with due dates into all-day calendar events', async () => {
    vi.mocked(api.getSemesterGradebook).mockResolvedValue({
      semester_id: 'semester-1',
      assessments: [
        {
          id: 'assessment-1',
          course_id: 'course-1',
          course_name: 'Algorithms',
          category_id: null,
          title: 'Midterm',
          due_date: '2026-02-14',
          weight: 25,
          score: 82,
          points_earned: null,
          points_possible: null,
          order_index: 0,
          gradebook_revision: 1,
        },
        {
          id: 'assessment-2',
          category_id: null,
          course_id: 'course-1',
          course_name: 'Algorithms',
          title: 'Participation',
          due_date: null,
          weight: 10,
          score: null,
          points_earned: null,
          points_possible: null,
          order_index: 1,
          gradebook_revision: 1,
        },
      ],
    });

    const events = await source.load(context);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'gradebook:course-1:assessment-1:2026-02-14',
      eventId: 'assessment-1',
      sourceId: BUILTIN_CALENDAR_SOURCE_GRADEBOOK,
      title: 'Midterm',
      courseId: 'course-1',
      courseName: 'Algorithms',
      eventTypeCode: 'Assessment',
      allDay: true,
      startTime: 'All day',
      endTime: 'All day',
    });
    expect(events[0]?.start.getFullYear()).toBe(2026);
    expect(events[0]?.start.getMonth()).toBe(1);
    expect(events[0]?.start.getDate()).toBe(14);
    expect(events[0]?.end.getFullYear()).toBe(2026);
    expect(events[0]?.end.getMonth()).toBe(1);
    expect(events[0]?.end.getDate()).toBe(15);
    expect(api.getSemesterGradebook).toHaveBeenCalledWith('semester-1', {
      due_start: '2026-01-05',
      due_end: '2026-05-07',
    });
  });

  it('refreshes on gradebook assessment updates but ignores other course-local event changes', () => {
    expect(source.shouldRefresh({
      type: 'partial',
      scopeId: 'semester-1',
      entityId: 'course-1',
      tag: 'gradebook-assessments-updated',
    }, context)).toBe(true);

    expect(source.shouldRefresh({
      type: 'partial',
      scopeId: 'semester-1',
      entityId: 'course-1',
      tag: 'event-updated',
    }, context)).toBe(false);
  });
});
