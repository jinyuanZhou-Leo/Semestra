// input:  [resource identifiers and request parameter objects from frontend data hooks]
// output: [`queryKeys` factory for stable TanStack Query cache keys across pages, contexts, and plugins]
// pos:    [Canonical cache-key registry preventing duplicated server-state entries and invalidation mismatches]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export const queryKeys = {
  programs: {
    all: ['programs'] as const,
    list: () => ['programs', 'list'] as const,
    detail: (programId: string) => ['programs', 'detail', programId] as const,
  },
  semesters: {
    detail: (semesterId: string) => ['semesters', 'detail', semesterId] as const,
    pluginSettings: (semesterId: string) => ['semesters', semesterId, 'plugin-settings'] as const,
    todo: (semesterId: string) => ['semesters', semesterId, 'todo'] as const,
    schedule: (semesterId: string, params: { mode: string; week: number; withConflicts: boolean }) => (
      ['semesters', semesterId, 'schedule', params] as const
    ),
  },
  courses: {
    detail: (courseId: string) => ['courses', 'detail', courseId] as const,
    pluginSettings: (courseId: string) => ['courses', courseId, 'plugin-settings'] as const,
    gradebook: (courseId: string) => ['courses', courseId, 'gradebook'] as const,
    eventTypes: (courseId: string) => ['courses', courseId, 'event-types'] as const,
    sections: (courseId: string) => ['courses', courseId, 'sections'] as const,
    events: (courseId: string) => ['courses', courseId, 'events'] as const,
    schedule: (courseId: string, params: Record<string, unknown>) => ['courses', courseId, 'schedule', params] as const,
  },
  user: {
    me: () => ['user', 'me'] as const,
  },
};
