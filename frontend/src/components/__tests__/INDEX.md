<!-- ⚠️ Once this folder changes, update me. -->

Component-level unit tests using Vitest + Testing Library.
These tests validate base rendering behavior of shared components and shared empty-state composition.
They run inside the jsdom test environment.

| File | Role | Description |
|------|------|-------------|
| AppEmptyState.test.tsx | Test file | Regression coverage for shared application empty-state rendering and inherit-surface behavior. |
| Button.test.tsx | Test file | Test coverage for button.test behavior. |
| CourseManagerModal.test.tsx | Test file | Regression coverage for Program-level create and Semester-level existing-course add flows closing immediately after a successful mutation even if post-submit refresh work rejects. |
| CoursePluginManagementPanel.test.tsx | Test file | Regression coverage for unassigned-Course plugin toggles, bulk toggles, and plugin-info rendering without exposing Semester-style setup/delete controls. |
| DataTable.test.tsx | Test file | Regression coverage for shared data-table overflow containment, fixed left-right header layout, explicit caller-owned minimum widths, default fill-width plus small minimum-column sizing, and the absence of a forced shared table width. |
| GPAScalingTable.test.tsx | Test file | Regression coverage for GPA scaling table create-empty rendering, decimal-gap warnings, and delete confirmation. |
| ProgramPluginManagementPanel.test.tsx | Test file | Regression coverage for Program-level plugin install, responsive marketplace presentation, required-plugin lock states, header-level bulk toggles, and downstream Semester/Course cache invalidation. |
| SemesterPluginManagementPanel.test.tsx | Test file | Regression coverage for Semester-level enable toggles, missing marketplace entry points, Program-enabled virtual off rows, header-level bulk toggles, and the toggle-only no-delete rule inside the management panel. |
| SemesterSettingsPanel.test.tsx | Test file | Regression coverage for Semester settings invalid-state attributes so valid date ranges do not trip shadcn destructive styling. |
| Tabs.test.tsx | Test file | Regression coverage for shared dashboard tab-shell alignment, horizontal overflow edge shadows, wheel-driven horizontal scrolling, and core tab actions. |
