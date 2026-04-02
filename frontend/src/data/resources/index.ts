// input:  [app-side TanStack resource modules for Program, Semester, Course, user, and domain-specific server-state access]
// output: [barrel exports for app-side data resource modules]
// pos:    [Host data-resource barrel used to keep app-side TanStack imports anchored under one subtree]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export * from './courseSchedule';
export * from './courses';
export * from './gradebook';
export * from './programs';
export * from './semesters';
export * from './semesterTodo';
export * from './user';
export * from './workspaceEntities';
