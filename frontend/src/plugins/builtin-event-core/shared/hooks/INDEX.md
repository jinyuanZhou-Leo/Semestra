<!-- ⚠️ Once this folder changes, update me. -->

`shared/hooks/` contains reusable event-core hooks that sit below tab-specific UI.
These hooks focus on cache-aware schedule fetching and mutation-safe loading transitions.
Tests in this folder guard against duplicate refresh states after the initial load completes.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for shared event-core hooks and tests. |
| useScheduleData.ts | Data hook | Cached semester schedule loader with single-week/all-weeks modes and refresh state. |
| useScheduleData.test.tsx | Test file | Verifies the schedule hook does not trigger a duplicate refresh cycle after first load. |
