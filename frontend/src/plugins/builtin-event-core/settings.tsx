// input:  [event-core tab settings sections, public plugin-system tab settings contracts, and shared todo settings component]
// output: [calendar, course-schedule, and todo tab settings components owned by the builtin-event-core settings entry]
// pos:    [settings entry that centralizes builtin-event-core tab settings UI without changing the runtime behavior]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';

import type { TabSettingsProps } from '@/plugin-system';

import { CalendarSettingsSection } from './tabs/calendar';
import { CourseScheduleSettings } from './tabs/course-schedule';
import { TodoSettingsSection } from './tabs/todo/TodoSettingsSection';

export const BuiltinAcademicCalendarTabSettings: React.FC<TabSettingsProps> = ({ semesterId, settings, updateSettings }) => {
  if (!semesterId) return null;
  return (
    <CalendarSettingsSection
      semesterId={semesterId}
      settings={settings}
      updateSettings={updateSettings}
    />
  );
};

export const BuiltinCourseScheduleTabSettings: React.FC<TabSettingsProps> = ({ courseId }) => {
  if (!courseId) return null;
  return <CourseScheduleSettings courseId={courseId} />;
};

export { TodoSettingsSection };
