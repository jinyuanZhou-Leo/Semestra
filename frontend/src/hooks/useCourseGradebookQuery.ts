// input:  [legacy imports requesting Course gradebook query helpers]
// output: [re-exported Course gradebook hooks from the app-side data resource layer]
// pos:    [Compatibility hook entry preserving existing import paths while Course gradebook helpers live under `@/data/resources`]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export {
  useCourseGradebookMutation,
  useCourseGradebookQuery,
} from '@/data/resources/gradebook';
