<!-- ⚠️ Once this folder changes, update me. -->

Gradebook tab subcomponents extracted from the main plugin runtime file.
These files isolate presentation-heavy table and dialog UI from the tab's query, mutation, and plan-mode orchestration.
The main tab now stays focused on gradebook state transitions and plugin wiring.

| File | Role | Description |
|------|------|-------------|
| AssessmentDialog.tsx | Form dialog | Owns manual and LMS-backed assessment add/edit UI plus the shared draft factory used by the tab. |
| CourseAssessmentsTable.tsx | Table | Assessment DataTable, column hook, and empty state for the course gradebook tab. |
| CourseFinalGradeSection.tsx | Section | Final grade override entry and inline edit controls. |
| CourseGradebookActionBar.tsx | Toolbar | Plan Mode toggle, target input, and Add Assessment / Auto-fill actions. |
| CourseGradebookHeaderStats.tsx | Stats strip | Course grade and GPA header tiles with plan-mode and weight-mismatch styling. |
| PlanModeDialogs.tsx | Dialogs | Shared Plan Mode enter/exit dialogs plus course final-grade and delete confirmations. |
| SemesterGradebookSections.tsx | Semester UI | Semester stats strip, toolbar, course table, and column hook. |
| SortableHead.tsx | Table utility | Renders clickable assessment table headers with consistent sort-state affordances. |
