// input:  [course lookup API, shared timetable event bus, and schedule-change payload contracts]
// output: [`publishTimetableScheduleChange()` helper for emitting semester-scoped Calendar refresh signals]
// pos:    [shared event-core publisher — synchronous when semesterId is already known, async fallback via course API when only courseId is available]
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
  signalId?: string;
}

export const publishTimetableScheduleChange = ({
  source,
  reason,
  courseId,
  semesterId,
  signalId,
}: PublishTimetableScheduleChangeParams): void => {
  if (semesterId) {
    timetableEventBus.publish('timetable:schedule-data-changed', {
      source,
      reason,
      courseId,
      semesterId,
      signalId,
    });
    return;
  }

  // semesterId unknown — resolve via API then publish (fire-and-forget)
  if (source !== 'course' || !courseId) return;
  void api.getCourse(courseId).then((course) => {
    const resolvedSemesterId = course.semester_id ?? undefined;
    if (!resolvedSemesterId) return;
    timetableEventBus.publish('timetable:schedule-data-changed', {
      source,
      reason,
      courseId,
      semesterId: resolvedSemesterId,
      signalId,
    });
  }).catch(() => { /* silently ignore resolution failures */ });
};
