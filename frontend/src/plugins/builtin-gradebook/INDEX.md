<!-- ⚠️ Once this folder changes, update me. -->

`builtin-gradebook/` provides the course-scoped Gradebook V2 tab and summary widget.
The tab centers a Course List-style assessment workspace with percentage scores, category-based forecasts, and a temporary Plan mode for What If scores.
Runtime UI consumes a slim fact-only API while shared helpers derive summaries, forecasts, and plan recommendations on the client, now blocking all Gradebook math until total assessment weight reaches 100%, including shared TanStack Query caching reused by both the tab and settings surface, a CSS-only responsive course-only metrics widget aligned with workspace stat styling and stacked vertically to fill widget height, and standardized semantic empty states for create, no-results, and unavailable flows.
Assessment create/edit/delete flows also publish a targeted timetable refresh so Calendar can mirror any non-empty assessment due date as a gradebook source event without caring about the score field.
The add-assessment dialog also supports one-time LMS assignment import into local Gradebook rows without turning Gradebook into a synced LMS mirror.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local architecture summary and file map for the builtin-gradebook plugin. |
| index.ts | Runtime entry | Registers the builtin-gradebook tab and summary widget with the plugin runtime loader. |
| metadata.ts | Plugin metadata | Declares the course builtin tab and responsive course-metrics widget catalog entries. |
| settings.tsx | Plugin settings | Provides course-level forecast mode radio selection plus an Event-types-style category management table with tighter mobile minimum width and a shadcn `Field`-based category form dialog for the Gradebook plugin, now sharing the same query-backed gradebook cache as the tab. |
| shared.ts | Shared helpers | Exposes plugin constants, client-side forecast/plan calculators, total-weight gating that disables calculations below 100%, sorting, shared formatters, slate-consistent fallback color helpers, and contrast-safe hex badge styling. |
| shared.test.ts | Test file | Covers client-side gradebook summary, incomplete-weight calculation gating, plan-mode helper math, fallback category colors, and custom-hex badge styling. |
| tab.tsx | Tab runtime | Renders the assessment-first Gradebook tab with the moved course stat strip, selective `user-select: none` protection on non-editing controls, a rounded toolbar that keeps search fixed on the left, fixed-height mode-derived action slots on the right, incomplete-weight red warning cards that suppress Grade/GPA calculation below 100%, Plan-only target and What If generation controls, a two-mode Add Assessment dialog that now uses full-width shadcn tabs plus a fixed-height LMS assignment picker with scrolling and provider-normalized due dates, semantic empty-state wrappers for create/no-results/unavailable flows, shared query-backed gradebook loading/mutation state, grade-calculator-style course-dashboard stat syncing after gradebook saves, and targeted Calendar refresh publishing for due-date assessment changes. |
| widget.test.tsx | Test file | Covers responsive course-metrics widget rendering against course payloads plus the course-context guard. |
| widget.tsx | Widget runtime | Renders the CSS-only responsive course-only widget that stacks vertically to fill available space, keeps KPI tiles non-selectable, shows Credits, GPA, and GPA Percentage with workspace-stat precision, and uses the shared unavailable empty-state wrapper for missing/error contexts. |
