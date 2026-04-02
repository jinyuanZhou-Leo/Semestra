// input:  [resource identifiers from app-side data resources]
// output: [`programKeys`, `semesterKeys`, `courseKeys`, `userKeys`, and aggregated `queryKeys`]
// pos:    [App-side query-key barrel that consolidates split key registries for host data access]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { courseKeys } from './courses';
import { programKeys } from './programs';
import { semesterKeys } from './semesters';
import { userKeys } from './user';

export { courseKeys, programKeys, semesterKeys, userKeys };

export const queryKeys = {
  programs: programKeys,
  semesters: semesterKeys,
  courses: courseKeys,
  user: userKeys,
};
