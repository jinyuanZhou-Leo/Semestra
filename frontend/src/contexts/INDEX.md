<!-- ⚠️ Once this folder changes, update me. -->

React context providers for auth, dialogs, and entity-scoped data state.
Encapsulates optimistic updates and refresh flows for program/semester/course pages.
Exposes typed hooks so page modules can consume shared state safely.

| File | Role | Description |
|------|------|-------------|
| AuthContext.tsx | Context module | Context provider/hook layer for auth context state. |
| BuiltinTabContext.tsx | Context module | Context provider/hook layer for builtin tab state, including separate layout local-sync and commit callbacks. |
| CourseDataContext.tsx | Context module | Context provider/hook layer for course data context state. |
| DialogContext.tsx | Context module | Context provider/hook layer for dialog context state. |
| ProgramDataContext.tsx | Context module | Context provider/hook layer for program data context state. |
| SemesterDataContext.tsx | Context module | Context provider/hook layer for semester data context state. |
