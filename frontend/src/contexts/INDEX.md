<!-- ⚠️ Once this folder changes, update me. -->

React context providers for auth, dialogs, and entity-scoped data state.
Encapsulates Query-backed optimistic updates, cookie-session refresh flows, cache reset on sign-out, and authenticated page bootstrapping.
Exposes typed hooks so page modules can consume shared state safely.

| File | Role | Description |
|------|------|-------------|
| AuthContext.tsx | Context module | Context provider/hook layer for cookie-backed auth state, session refresh, logout/session-expiry handling, and shared query-cache reset when auth state is cleared. |
| BuiltinTabContext.tsx | Context module | Context provider/hook layer for builtin tab state, including dashboard overview slots plus separate layout local-sync, commit, and unavailable-widget delete callbacks. |
| CourseDataContext.tsx | Context module | Context provider/hook layer for course data that now fronts a shared Query cache while preserving the existing page-facing API. |
| DialogContext.tsx | Context module | Context provider/hook layer for dialog context state. |
| ProgramDataContext.tsx | Context module | Context provider/hook layer for program data that now fronts a shared Query cache while preserving the existing page-facing API. |
| SemesterDataContext.tsx | Context module | Context provider/hook layer for semester data that now fronts a shared Query cache while preserving the existing page-facing API. |
