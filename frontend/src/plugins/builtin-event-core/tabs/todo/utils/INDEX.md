<!-- ⚠️ Once this folder changes, update me. -->

`utils/` contains Todo serialization, normalization, persistence-sync, and shared mutation helpers.
These files keep TodoTab orchestration lean by centralizing storage shaping and cross-surface mutation rules.
Calendar-side todo completion now reuses this folder so Todo and Calendar stay behaviorally aligned.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for todo utility modules. |
| todoCalendarSync.ts | Calendar sync helper | Persists Calendar-side todo completion toggles and broadcasts Todo storage sync payloads. |
| todoData.ts | Data utilities | Normalization, serialization, parsing, and formatting helpers for todo lists, sections, and tasks. |
| todoMutations.ts | Mutation helpers | Shared task-completion mutation logic reused by Todo and Calendar flows. |
