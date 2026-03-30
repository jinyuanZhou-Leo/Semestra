<!-- ⚠️ Once this folder changes, update me. -->

`builtin-event-core/` is the core domain plugin that bundles schedule, calendar, and todo experiences.
It now also exposes a descriptor-backed Semester setup onboarding entry so the wizard can collect calendar defaults and event-type presets before activation.
Subfolders split reusable dialogs/utilities from tab-specific UI to keep semester workflows cohesive while preserving keyboard access, scoped schedule refreshes, source-driven Calendar rendering, buffered range-based Calendar fetching, cached-detail-backed export settings that avoid eager all-week schedule preloads, configurable week-view scroll width, DST-safe academic week math, persisted Calendar navigation UI state, inline-first Todo editing, persisted Todo section visibility, safer destructive flows, and setup-time reuse of the same event-type table language used by settings.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the built-in event core plugin structure and responsibilities. |
| components/ | Shared dialogs | Reusable CRUD forms and shared event/schedule editing dialogs. |
| components/INDEX.md | Shared components architecture index | File map for reusable event-core dialogs and weekly conflict-aware schedule rendering. |
| plugin.json | Plugin manifest | Static public manifest for plugin identity plus event-core tab/widget/settings metadata shared with the backend. |
| plugin.ts | Plugin entry | Binds the descriptor, lazy runtime loader, and optional setup UI into one frontend plugin definition. |
| setup.schema.json | Setup schema | Static Semester setup contract shared by the frontend wizard and backend plugin management validation. |
| index.ts | Runtime entry | Exports plugin definitions and metadata bindings for loader integration. |
| setup.test.tsx | Test file | Verifies builtin-event-core setup defaults plus event-type validation rules for the Semester wizard. |
| setup.tsx | Setup entry | Declares builtin-event-core Semester setup fields and renders a custom wizard/review UI with a settings-style event-type configuration table that now supplies its own four-column minimum width instead of relying on a shared default. |
| settings.tsx | Settings entry | Keeps plugin-global settings discovery stable without opting built-in event-core behavior into the framework-managed shared-settings persistence path. |
| shared/ | Shared domain layer | Constants, event bus, hooks, types, and helpers shared by event-core tabs/widgets, including source ids, gradebook-aware refresh payloads, and Reading Week-aware calendar semantics. |
| shared/INDEX.md | Shared architecture index | File map for shared schedule payloads, event bus contracts, and cache-aware hooks. |
| tab.tsx | Tab definition entry | Exposes tab runtime definitions plus generic tab instance settings wiring for plugin-system consumption. |
| tabs/ | Tab modules | Calendar, course-schedule, and todo feature implementations, including registry-backed Calendar source adapters for buffered schedule/todo/gradebook/LMS overlays and configurable week-view scroll width. |
| widget.tsx | Widget runtime | Event-core widget card runtime and schedule summary presentation with DST-safe current-week lookup. |
