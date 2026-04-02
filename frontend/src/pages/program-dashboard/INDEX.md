<!-- ⚠️ Once this folder changes, update me. -->

Program-home-only subcomponents extracted from the main Program route.
These files isolate Focus Board and create/delete entry actions from the page-level data orchestration.
The route stays focused on workspace composition, filtering, list rendering, and standalone wizard navigation.

| File | Role | Description |
|------|------|-------------|
| FocusBoardLayout.ts | Layout solver | Owns the Focus Board two-row layout engine, including manual-layout normalization, right-push collision avoidance, drag-preview solving, and settings/layout reconciliation so the view component only wires events and rendering. |
| FocusBoardLayout.test.ts | Test file | Regression coverage for the Focus Board two-row engine, including conflicting manual layouts, drag collision push chains, and append-after-manual packing. |
| CreateSemesterDialogButton.tsx | Legacy dialog trigger | Owns the older empty/calendar/LMS semester creation dialog flow that remains in the tree during the standalone wizard migration. |
| CreateSemesterWizardButton.tsx | Wizard trigger | Routes into the standalone Create Semester page and handles resume/discard decisions when a draft already exists. |
| DeleteSemesterButton.tsx | Dialog trigger | Encapsulates semester deletion confirmation and async mutation feedback for dashboard cards. |
| ProgramFocusBoard.tsx | Program-home board | Renders the Program Home Focus Board for pinned Semester/Course cards, including split Semester/Course add lists, optimistic add/remove updates, pointer-driven drag-and-drop with automatic right-push avoidance, and fixed absolute card sizes inside a horizontally scrolling two-row strip. |
