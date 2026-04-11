// input:  [calendar-core refresh signal types and timetable scope identifiers]
// output: [timetableSignal builder helpers for constructing typed CalendarRefreshSignals with unique signalIds]
// pos:    [shared signal factory layer used by CalendarTab and anywhere timetable refresh signals are created]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { CalendarRefreshSignal } from '../calendar-core';

const generateSignalId = () => Math.random().toString(36).slice(2, 10);

export const timetableSignal = {
  courseChanged: (semesterId: string, courseId: string, tag: string): CalendarRefreshSignal => ({
    type: 'partial',
    scopeId: semesterId,
    entityId: courseId,
    tag,
    signalId: generateSignalId(),
  }),
  semesterChanged: (semesterId: string): CalendarRefreshSignal => ({
    type: 'full',
    scopeId: semesterId,
    signalId: generateSignalId(),
  }),
  manual: (): CalendarRefreshSignal => ({ type: 'manual', signalId: generateSignalId() }),
} as const;
