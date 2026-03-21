// input:  [Vitest assertions, builtin gradebook calendar source, and mocked semester/gradebook API responses]
// output: [tests covering gradebook assessment-to-calendar mapping and targeted refresh behavior]
// pos:    [calendar source regression suite for due-date-driven gradebook overlays]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it, vi } from 'vitest';
import api from '@/services/api';
import { builtinGradebookCalendarSource } from './gradebookSource';
import { BUILTIN_CALENDAR_SOURCE_GRADEBOOK } from '../../../shared/constants';

vi.mock('@/services/api', () => ({
  default: {
    getSemester: vi.fn(),
    getCourseGradebook: vi.fn(),
  },
}));

describe('builtinGradebookCalendarSource', () => {
  const context = {
    semesterId: 'semester-1',
    semesterRange: {
      startDate: new Date('2026-01-05T00:00:00'),
      endDate: new Date('2026-04-30T00:00:00'),
      readingWeekStart: null,
      readingWeekEnd: null,
    },
    maxWeek: 16,
    queryRange: {
      start: new Date('2026-01-05T00:00:00'),
      end: new Date('2026-05-07T00:00:00'),
    },
  };

  it('maps only assessments with due dates into all-day calendar events', async () => {
    vi.mocked(api.getSemester).mockResolvedValue({
      id: 'semester-1',
      name: 'Winter 2026',
      average_scaled: 0,
      average_percentage: 0,
      courses: [
        {
          id: 'course-1',
          name: 'Algorithms',
          credits: 0.5,
          grade_scaled: 0,
          grade_percentage: 0,
          program_id: 'program-1',
          semester_id: 'semester-1',
          has_gradebook: true,
          gradebook_revision: 1,
        },
      ],
    } as any);
    vi.mocked(api.getCourseGradebook).mockResolvedValue({
      course_id: 'course-1',
      target_gpa: 4,
      forecast_model: 'auto',
      scaling_table: {},
      categories: [],
      assessments: [
        {
          id: 'assessment-1',
          category_id: null,
          title: 'Midterm',
          due_date: '2026-02-14',
          weight: 25,
          score: 82,
          points_earned: null,
          points_possible: null,
          order_index: 0,
        },
        {
          id: 'assessment-2',
          category_id: null,
          title: 'Participation',
          due_date: null,
          weight: 10,
          score: null,
          points_earned: null,
          points_possible: null,
          order_index: 1,
        },
      ],
    });

    const events = await builtinGradebookCalendarSource.load(context);

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
  });

  it('refreshes on gradebook assessment updates but ignores other course-local event changes', () => {
    expect(builtinGradebookCalendarSource.shouldRefresh({
      type: 'timetable',
      source: 'course',
      reason: 'gradebook-assessments-updated',
      semesterId: 'semester-1',
      courseId: 'course-1',
    }, context)).toBe(true);

    expect(builtinGradebookCalendarSource.shouldRefresh({
      type: 'timetable',
      source: 'course',
      reason: 'event-updated',
      semesterId: 'semester-1',
      courseId: 'course-1',
    }, context)).toBe(false);
  });
});
