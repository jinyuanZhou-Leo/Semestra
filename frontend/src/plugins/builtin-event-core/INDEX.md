<!-- ⚠️ Once this folder changes, update me. -->

`builtin-event-core/` is the core domain plugin that bundles schedule, calendar, and todo experiences.
It now also exposes a descriptor-backed Semester setup onboarding entry so the wizard can collect calendar defaults and event-type presets before activation, with `setup.tsx` acting as the single setup source of truth for both frontend wizard rendering and backend schema generation.
Subfolders split reusable dialogs/utilities from tab-specific UI to keep semester workflows cohesive while preserving keyboard access, scoped schedule refreshes, source-driven Calendar rendering, buffered range-based Calendar fetching, cached-detail-backed export settings that avoid eager all-week schedule preloads, configurable week-view scroll width, DST-safe academic week math, persisted Calendar navigation UI state, inline-first Todo editing, persisted Todo section visibility, new Program-level Todo defaults backed by Program tab settings, safer destructive flows, and setup-time reuse of the same event-type table language used by settings.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the built-in event core plugin structure and responsibilities. |
| components/ | Shared dialogs | Reusable CRUD forms and shared event/schedule editing dialogs. |
| components/INDEX.md | Shared components architecture index | File map for reusable event-core dialogs and weekly conflict-aware schedule rendering. |
| plugin.ts | Plugin entry | Single typed plugin authoring entry that declares event-core metadata, lazy runtime loading, a Program-level Todo defaults settings section, and optional setup UI while binding setup directly from `setup.tsx` instead of maintaining a separate inline setup schema. |
| index.ts | Runtime entry | Exports plugin definitions and metadata bindings for loader integration. |
| setup.test.tsx | Test file | Verifies builtin-event-core setup defaults plus event-type validation rules for the Semester wizard. |
| setup.tsx | Setup entry | Declares builtin-event-core Semester setup fields and renders a custom wizard/review UI with a settings-style event-type configuration table that now supplies its own four-column minimum width instead of relying on a shared default. |
| shared/ | Shared domain layer | Constants, event bus, hooks, types, and helpers shared by event-core tabs/widgets, including source ids, gradebook-aware refresh payloads, and Reading Week-aware calendar semantics. |
| shared/INDEX.md | Shared architecture index | File map for shared schedule payloads, event bus contracts, and cache-aware hooks. |
| settings.tsx | Settings entry | Owns the Calendar, Course Schedule, and Todo tab settings components while also exposing a Program-level Todo defaults section that persists through Program tab settings and now shows per-key inherited-layer badges plus reset-to-parent/default actions. |
| tab.tsx | Tab definition entry | Exposes tab runtime definitions and wires each tab to the settings components exported from `settings.tsx`. |
| tabs/ | Tab modules | Calendar, course-schedule, and todo feature implementations, including registry-backed Calendar source adapters for buffered schedule/todo/gradebook/LMS overlays and configurable week-view scroll width. |
| widget.tsx | Widget runtime | Event-core widget card runtime and schedule summary presentation with DST-safe current-week lookup. |
