<!-- ⚠️ Once this folder changes, update me. -->

Component-level unit tests using Vitest + Testing Library.
These tests validate base rendering behavior of shared components and shared empty-state composition.
They run inside the jsdom test environment.

| File | Role | Description |
|------|------|-------------|
| AppEmptyState.test.tsx | Test file | Regression coverage for shared application empty-state rendering and inherit-surface behavior. |
| Button.test.tsx | Test file | Test coverage for button.test behavior. |
| CrudPanel.test.tsx | Test file | Regression coverage for shared CRUD-panel overflow containment and mobile-safe table-shell sizing. |
| GPAScalingTable.test.tsx | Test file | Regression coverage for GPA scaling table create-empty rendering. |
| Tabs.test.tsx | Test file | Regression coverage for shared dashboard tab-shell alignment, horizontal overflow edge shadows, wheel-driven horizontal scrolling, and core tab actions. |
