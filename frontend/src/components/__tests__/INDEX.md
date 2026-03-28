<!-- ⚠️ Once this folder changes, update me. -->

Component-level unit tests using Vitest + Testing Library.
These tests validate base rendering behavior of shared components and shared empty-state composition.
They run inside the jsdom test environment.

| File | Role | Description |
|------|------|-------------|
| AppEmptyState.test.tsx | Test file | Regression coverage for shared application empty-state rendering and inherit-surface behavior. |
| Button.test.tsx | Test file | Test coverage for button.test behavior. |
| CourseManagerModal.test.tsx | Test file | Regression coverage for Program-level Add Course closing immediately after a successful create even if post-create refresh work rejects. |
| DataTable.test.tsx | Test file | Regression coverage for shared data-table overflow containment, mobile-safe table-shell sizing, and content-complete auto column sizing defaults. |
| GPAScalingTable.test.tsx | Test file | Regression coverage for GPA scaling table create-empty rendering, decimal-gap warnings, and delete confirmation. |
| ProgramPluginGovernancePanel.test.tsx | Test file | Regression coverage for Program-level plugin install, responsive marketplace presentation, required-plugin lock states, and downstream Semester/Course cache invalidation. |
| SemesterPluginGovernancePanel.test.tsx | Test file | Regression coverage for Semester-level enable toggles, missing marketplace entry points, Program-enabled virtual off rows, and the toggle-only no-delete rule inside the governance panel. |
| SemesterSettingsPanel.test.tsx | Test file | Regression coverage for Semester settings invalid-state attributes so valid date ranges do not trip shadcn destructive styling. |
| Tabs.test.tsx | Test file | Regression coverage for shared dashboard tab-shell alignment, horizontal overflow edge shadows, wheel-driven horizontal scrolling, and core tab actions. |
