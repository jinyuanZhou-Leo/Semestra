# Builtin Timetable Migration Notes

This plugin was reorganized to follow the phase-1 target structure.

## Import Path Migration

- `./CrudPanel` -> `./components/CrudPanel`
- `./EventTypeFormDialog` -> `./components/EventTypeFormDialog`
- `./SectionFormDialog` -> `./components/SectionFormDialog`
- `./tab` now acts as plugin entry and composes tab implementations from `./tabs/**`

Top-level files still re-export moved modules for in-plugin transition, but all new code should import from the structured paths.
