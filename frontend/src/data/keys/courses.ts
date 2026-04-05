// input:  [Course ids plus Course-scoped request parameter objects from app-side data resources]
// output: [`courseKeys` factory for stable Course detail, plugin, tab-settings, LMS, resource, and schedule cache identifiers]
// pos:    [App-side Course query-key registry used by host data resources, contexts, and pages]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export const courseKeys = {
  all: ['courses'] as const,
  detail: (courseId: string) => ['courses', 'detail', courseId] as const,
  tabSettings: (courseId: string) => ['courses', courseId, 'tab-settings'] as const,
  pluginActivations: (courseId: string) => ['courses', courseId, 'plugin-activations'] as const,
  resources: (courseId: string) => ['courses', courseId, 'resources'] as const,
  gradebook: (courseId: string) => ['courses', courseId, 'gradebook'] as const,
  eventTypes: (courseId: string) => ['courses', courseId, 'event-types'] as const,
  sections: (courseId: string) => ['courses', courseId, 'sections'] as const,
  events: (courseId: string) => ['courses', courseId, 'events'] as const,
  schedule: (courseId: string, params: Record<string, unknown>) => ['courses', courseId, 'schedule', params] as const,
  lmsLink: (courseId: string) => ['courses', courseId, 'lms-link'] as const,
  lmsAssignments: (courseId: string) => ['courses', courseId, 'lms-assignments'] as const,
  lmsGrades: (courseId: string) => ['courses', courseId, 'lms-grades'] as const,
  lmsNavigation: (courseId: string) => ['courses', courseId, 'lms-navigation'] as const,
  lmsAnnouncements: (courseId: string) => ['courses', courseId, 'lms-announcements'] as const,
  lmsModules: (courseId: string) => ['courses', courseId, 'lms-modules'] as const,
  lmsModuleItems: (courseId: string, moduleId: string) => ['courses', courseId, 'lms-module-items', moduleId] as const,
  lmsModuleFile: (courseId: string, moduleId: string, moduleItemId: string) => (
    ['courses', courseId, 'lms-module-file', moduleId, moduleItemId] as const
  ),
  lmsQuizzes: (courseId: string) => ['courses', courseId, 'lms-quizzes'] as const,
  lmsPages: (courseId: string) => ['courses', courseId, 'lms-pages'] as const,
  lmsPage: (courseId: string, pageRef: string) => ['courses', courseId, 'lms-page', pageRef] as const,
  lmsSyllabus: (courseId: string) => ['courses', courseId, 'lms-syllabus'] as const,
};
