<!-- ⚠️ Once this folder changes, update me. -->

`builtin-event-core/` is the core domain plugin that bundles schedule, calendar, and todo experiences.
It exposes plugin metadata/runtime entrypoints plus shared data/event primitives consumed by tab modules.
Subfolders split reusable dialogs/utilities from tab-specific UI to keep semester workflows cohesive while preserving keyboard access, scoped schedule refreshes, and safer destructive flows.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the built-in event core plugin structure and responsibilities. |
| components/ | Shared dialogs | Reusable CRUD forms and shared event/schedule editing dialogs. |
| components/INDEX.md | Shared components architecture index | File map for reusable event-core dialogs and weekly conflict-aware schedule rendering. |
| index.ts | Runtime entry | Exports plugin definitions and metadata bindings for loader integration. |
| metadata.ts | Plugin metadata | Declares plugin id and catalog-visible tab/widget metadata. |
| settings.tsx | Settings registry | Registers tab-level settings panels for calendar, course schedule, and todo modules. |
| shared/ | Shared domain layer | Constants, event bus, hooks, types, and helpers shared by event-core tabs/widgets. |
| shared/INDEX.md | Shared architecture index | File map for shared schedule payloads, event bus contracts, and cache-aware hooks. |
| tab.tsx | Tab definition entry | Exposes tab runtime definitions and wiring for plugin system consumption. |
| tabs/ | Tab modules | Calendar, course-schedule, and todo feature implementations. |
| widget.tsx | Widget runtime | Event-core widget card runtime and schedule summary presentation. |
