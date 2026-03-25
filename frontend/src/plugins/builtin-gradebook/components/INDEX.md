<!-- ⚠️ Once this folder changes, update me. -->

Gradebook tab subcomponents extracted from the main plugin runtime file.
These files isolate presentation-heavy table and dialog UI from the tab's query, mutation, and plan-mode orchestration.
The main tab now stays focused on gradebook state transitions and plugin wiring.

| File | Role | Description |
|------|------|-------------|
| AssessmentDialog.tsx | Form dialog | Owns manual and LMS-backed assessment add/edit UI plus the shared draft factory used by the tab. |
| SortableHead.tsx | Table utility | Renders clickable assessment table headers with consistent sort-state affordances. |
