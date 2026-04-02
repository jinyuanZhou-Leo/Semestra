<!-- ⚠️ Once this folder changes, update me. -->

Split query-key registries for app-side host resources.
Keeps key ownership by business resource instead of one monolithic file.
Aggregated `index.ts` still exposes a single `queryKeys` object for convenience.

| File | Role | Description |
|------|------|-------------|
| courses.ts | Key registry | Course-scoped cache keys for details, plugin activations, schedule, resources, and LMS data. |
| index.ts | Barrel module | Re-exports split key registries and assembles the aggregated app-side `queryKeys` object. |
| programs.ts | Key registry | Program-scoped cache keys for lists, details, plugin governance, drafts, and LMS course discovery. |
| semesters.ts | Key registry | Semester-scoped cache keys for details, plugin setup, todo, schedule, and LMS calendar data. |
| user.ts | Key registry | Current-user and LMS integration cache keys used by auth and settings surfaces. |
