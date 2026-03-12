<!-- ⚠️ Once this folder changes, update me. -->

`utils/` contains Todo API mapping, normalization, light legacy parsing, and shared mutation helpers.
These files keep TodoTab orchestration lean by centralizing semester aggregate shaping and cross-surface mutation rules.
Calendar-side todo completion reuses this folder so Todo and Calendar stay behaviorally aligned with the table-backed semester model.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for todo utility modules. |
| todoCalendarSync.ts | Calendar sync helper | Persists Calendar-side todo completion toggles through the semester todo API and publishes refresh signals for Todo and Calendar. |
| todoData.ts | Data utilities | API-to-runtime mapping, formatting, and minimal legacy parsing helpers for note-aware semester todo state and local sorting. |
| todoMutations.ts | Mutation helpers | Shared task-completion mutation logic reused by Todo and Calendar flows. |
