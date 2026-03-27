<!-- ⚠️ Once this folder changes, update me. -->

Program-dashboard-only subcomponents extracted from the main route file.
These files isolate create/delete entry actions from the page-level data orchestration.
The route stays focused on workspace composition, filtering, list rendering, and standalone wizard navigation.

| File | Role | Description |
|------|------|-------------|
| CreateSemesterDialogButton.tsx | Legacy dialog trigger | Owns the older empty/calendar/LMS semester creation dialog flow that remains in the tree during the standalone wizard migration. |
| CreateSemesterWizardButton.tsx | Wizard trigger | Routes into the standalone Create Semester page and handles resume/discard decisions when a draft already exists. |
| DeleteSemesterButton.tsx | Dialog trigger | Encapsulates semester deletion confirmation and async mutation feedback for dashboard cards. |
