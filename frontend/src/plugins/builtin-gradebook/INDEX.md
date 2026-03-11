<!-- ⚠️ Once this folder changes, update me. -->

`builtin-gradebook/` provides the course-scoped Gradebook V2 tab and summary widget.
The tab centers a Course List-style assessment workspace with percentage scores, category-based forecasts, and a temporary Plan mode for What If scores.
Runtime UI consumes a slim fact-only API while shared helpers derive summaries, forecasts, and plan recommendations on the client.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local architecture summary and file map for the builtin-gradebook plugin. |
| index.ts | Runtime entry | Registers the builtin-gradebook tab and summary widget with the plugin runtime loader. |
| metadata.ts | Plugin metadata | Declares the course builtin tab and summary widget catalog entries. |
| settings.tsx | Plugin settings | Provides course-level forecast mode radio selection with clearer guidance plus an Event-types-style category management table for the Gradebook plugin. |
| shared.ts | Shared helpers | Exposes plugin constants, client-side forecast/plan calculators, sorting, and shared formatters. |
| shared.test.ts | Test file | Covers client-side gradebook summary, forecast, and plan-mode helper math. |
| tab.tsx | Tab runtime | Renders the assessment-first Gradebook tab with the moved course stat strip, a rounded toolbar that keeps search fixed on the left, fixed-height mode-derived action slots on the right, Plan-only target and What If generation controls, hidden assessment creation while planning, and grade-calculator-style course-dashboard stat syncing after gradebook saves. |
| widget.test.tsx | Test file | Covers summary widget rendering against fact-only gradebook payloads and open-tab event dispatch. |
| widget.tsx | Widget runtime | Renders the compact summary widget with current results, forecast readiness, and next due assessments. |
