<!-- ⚠️ Once this folder changes, update me. -->

Program-dashboard-only subcomponents extracted from the main route file.
These files isolate async semester create/delete dialog behavior from the page-level data orchestration.
The route stays focused on workspace composition, filtering, and list rendering.

| File | Role | Description |
|------|------|-------------|
| CreateSemesterDialogButton.tsx | Dialog trigger | Owns the empty/calendar/LMS semester creation dialog, including ICS upload and LMS course selection state. |
| DeleteSemesterButton.tsx | Dialog trigger | Encapsulates semester deletion confirmation and async mutation feedback for dashboard cards. |
