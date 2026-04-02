// input:  [User ids and integration ids from app-side auth and settings data resources]
// output: [`userKeys` factory for stable current-user and LMS integration cache identifiers]
// pos:    [App-side user query-key registry used by auth, settings, and LMS resource modules]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export const userKeys = {
  all: ['user'] as const,
  me: () => ['user', 'me'] as const,
  lmsIntegrations: () => ['user', 'lms-integrations'] as const,
  lmsIntegration: (integrationId: string) => ['user', 'lms-integration', integrationId] as const,
};
