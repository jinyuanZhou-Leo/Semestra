<!-- ⚠️ Once this folder changes, update me. -->

Host-side data resource modules built on TanStack Query.
Each file owns query options, hooks, and invalidation helpers for one business area.
Pages and contexts consume these modules instead of re-creating cache rules inline.

| File | Role | Description |
|------|------|-------------|
| courseSchedule.ts | Resource module | Course schedule/event query builders plus shared schedule invalidation helpers. |
| courses.ts | Resource module | Course detail query builders plus Course LMS and plugin invalidation helpers. |
| gradebook.ts | Resource module | Course gradebook read/write hooks backed by shared cache updates. |
| index.ts | Barrel module | Re-exports app-side data resource modules. |
| programs.ts | Resource module | Program list/detail/catalog/draft/LMS query builders plus Program invalidation helpers. |
| semesters.ts | Resource module | Semester detail/setup query builders plus draft workflow cache hydration and teardown helpers. |
| semesterTodo.ts | Resource module | Semester todo query and cache helpers shared by host and plugin-adjacent flows. |
| user.ts | Resource module | Current-user LMS integration queries and invalidation helpers for settings/auth flows. |
| workspaceEntities.ts | Resource module | Shared Program/Semester/Course entity query builders and hooks for host contexts and pages. |
