// input:  [plugin-side and legacy host-side imports requesting canonical query keys]
// output: [re-exported `queryKeys` and split key registries from the app-side data key layer]
// pos:    [Legacy compatibility entry that keeps plugin code stable while app-side callers migrate to `@/data/keys`]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export {
  courseKeys,
  programKeys,
  queryKeys,
  semesterKeys,
  userKeys,
} from '@/data/keys';
