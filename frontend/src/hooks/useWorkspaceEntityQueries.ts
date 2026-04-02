// input:  [legacy imports requesting workspace entity query helpers]
// output: [re-exported workspace entity query option builders and hooks from the app-side data resource layer]
// pos:    [Compatibility hook entry preserving existing import paths while host query helpers live under `@/data/resources`]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export {
  getCourseQueryOptions,
  getProgramQueryOptions,
  getSemesterQueryOptions,
  useCourseQuery,
  useProgramQuery,
  useSemesterQuery,
} from '@/data/resources/workspaceEntities';
