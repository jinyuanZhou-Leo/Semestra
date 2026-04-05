// input:  [Semester ids plus Semester-scoped request parameter objects from app-side data resources]
// output: [`semesterKeys` factory for stable Semester detail, draft, plugin, tab-settings, todo, schedule, and LMS cache identifiers]
// pos:    [App-side Semester query-key registry used by host data resources, contexts, and pages]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export const semesterKeys = {
  all: ['semesters'] as const,
  detail: (semesterId: string) => ['semesters', 'detail', semesterId] as const,
  tabSettings: (semesterId: string) => ['semesters', semesterId, 'tab-settings'] as const,
  pluginActivations: (semesterId: string) => ['semesters', semesterId, 'plugin-activations'] as const,
  pluginSystemSetup: (semesterId: string) => ['plugin-system', 'semesters', semesterId, 'setup'] as const,
  todo: (semesterId: string) => ['semesters', semesterId, 'todo'] as const,
  schedule: (semesterId: string, params: { mode: string; week: number; withConflicts: boolean }) => (
    ['semesters', semesterId, 'schedule', params] as const
  ),
  calendarSchedule: (semesterId: string, params?: Record<string, unknown>) => (
    params
      ? ['semesters', semesterId, 'calendar-schedule', params] as const
      : ['semesters', semesterId, 'calendar-schedule'] as const
  ),
  lmsAssignments: (semesterId: string) => ['semesters', semesterId, 'lms-assignments'] as const,
  lmsCalendarEvents: (semesterId: string, params?: Record<string, unknown>) => (
    params
      ? ['semesters', semesterId, 'lms-calendar-events', params] as const
      : ['semesters', semesterId, 'lms-calendar-events'] as const
  ),
};
