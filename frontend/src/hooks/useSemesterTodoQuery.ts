// input:  [legacy imports requesting Semester todo query helpers]
// output: [re-exported Semester todo hooks from the app-side data resource layer]
// pos:    [Compatibility hook entry preserving existing import paths while Semester todo helpers live under `@/data/resources`]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export {
  useSemesterTodoCache,
  useSemesterTodoQuery,
} from '@/data/resources/semesterTodo';
