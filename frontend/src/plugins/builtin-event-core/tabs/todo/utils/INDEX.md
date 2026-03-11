<!-- ⚠️ Once this folder changes, update me. -->

`utils/` contains Todo serialization, normalization, migration, mirror-sync, and shared mutation helpers.
These files keep TodoTab orchestration lean by centralizing semester aggregate shaping, course mirror persistence, and cross-surface mutation rules.
Calendar-side todo completion reuses this folder so Todo and Calendar stay behaviorally aligned with the mirrored aggregate model.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for todo utility modules. |
| todoCalendarSync.ts | Calendar sync helper | Persists Calendar-side todo completion toggles into semester aggregate storage and mirrored course tabs, then broadcasts sync payloads. |
| todoData.ts | Data utilities | Migration, normalization, serialization, parsing, and formatting helpers for synchronized semester/course todo state. |
| todoMutations.ts | Mutation helpers | Shared task-completion mutation logic reused by Todo and Calendar flows. |
