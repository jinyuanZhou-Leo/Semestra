// input:  [Program ids plus Program-scoped request parameter objects from app-side data resources]
// output: [`programKeys` factory for stable Program list/detail/catalog/draft/cache identifiers]
// pos:    [App-side Program query-key registry used by host data resources, contexts, and pages]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export const programKeys = {
  all: ['programs'] as const,
  list: () => ['programs', 'list'] as const,
  detail: (programId: string) => ['programs', 'detail', programId] as const,
  tabSettings: (programId: string) => ['programs', programId, 'tab-settings'] as const,
  pluginCatalog: (programId: string) => ['programs', programId, 'plugin-catalog'] as const,
  pluginInstallations: (programId: string) => ['programs', programId, 'plugin-installations'] as const,
  semesterDraft: (programId: string) => ['programs', programId, 'semester-draft'] as const,
  lmsCourses: (programId: string, params: Record<string, unknown>) => ['programs', programId, 'lms-courses', params] as const,
};
