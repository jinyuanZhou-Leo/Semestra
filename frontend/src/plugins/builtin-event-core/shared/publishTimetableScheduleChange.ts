// input:  [course lookup API, shared timetable event bus, and schedule-change payload contracts]
// output: [`publishTimetableScheduleChange()` helper for emitting semester-scoped Calendar refresh signals]
// pos:    [shared event-core publisher that resolves missing semester context before broadcasting schedule-change events]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import api from '@/services/api';
import { timetableEventBus } from './eventBus';
import type { TimetableScheduleChangePayload } from './types';

interface PublishTimetableScheduleChangeParams {
  source: TimetableScheduleChangePayload['source'];
  reason: TimetableScheduleChangePayload['reason'];
  courseId?: string;
  semesterId?: string;
}

const resolveSemesterId = async ({
  source,
  courseId,
  semesterId,
}: Pick<PublishTimetableScheduleChangeParams, 'source' | 'courseId' | 'semesterId'>) => {
  if (semesterId) return semesterId;
  if (source !== 'course' || !courseId) return undefined;

  try {
    const course = await api.getCourse(courseId);
    return course.semester_id ?? undefined;
  } catch {
    return undefined;
  }
};

export const publishTimetableScheduleChange = async ({
  source,
  reason,
  courseId,
  semesterId,
}: PublishTimetableScheduleChangeParams) => {
  const resolvedSemesterId = await resolveSemesterId({
    source,
    courseId,
    semesterId,
  });
  if (!resolvedSemesterId) return false;

  timetableEventBus.publish('timetable:schedule-data-changed', {
    source,
    reason,
    courseId,
    semesterId: resolvedSemesterId,
  });
  return true;
};
