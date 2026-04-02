// input:  [legacy imports requesting Course schedule query helpers]
// output: [re-exported Course schedule query builders, hooks, and invalidation helpers from the app-side data resource layer]
// pos:    [Compatibility hook entry preserving existing import paths while Course schedule helpers live under `@/data/resources`]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export {
  getCourseEventTypesQueryOptions,
  getCourseEventsQueryOptions,
  getCourseScheduleQueryOptions,
  getCourseSectionsQueryOptions,
  invalidateCourseScheduleRelatedQueries,
  useCourseEventsQuery,
  useCourseEventTypesQuery,
  useCourseScheduleSnapshotQuery,
  useCourseSectionsQuery,
} from '@/data/resources/courseSchedule';
