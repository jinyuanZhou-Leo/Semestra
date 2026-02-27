<!-- ⚠️ Once this folder changes, update me. -->

Dashboard widget layout and container infrastructure.
Integrates react-grid-layout v2 behavior, moderate-opacity glassmorphism header controls, direct touch edit-mode actions, and plugin widget mounting.
Includes deterministic fallback placement, lower-frequency resize width commits, zero-width mount guards, and interaction-scoped local-sync plus commit-persistence layout flows.

| File | Role | Description |
|------|------|-------------|
| __tests__/ | Subdirectory | Test cases for modules in this folder. |
| DashboardGrid.tsx | UI component | Uses RGL v2 `useContainerWidth` (`1w = 1h`) with lower-frequency stabilized width commits, zero-width render guards on tab remount, interaction-scoped local layout sync, and drag/resize commit persistence callbacks. |
| DashboardWidgetWrapper.tsx | UI component | Builds plugin header actions with shared moderate-opacity glassmorphism button styling for widget top controls. |
| WidgetContainer.tsx | UI component | Renders widget chrome, drag/actions, and direct touch edit-mode header controls with softened, moderate-opacity glassmorphism affordances. |
