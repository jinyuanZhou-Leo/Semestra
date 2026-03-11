<!-- ⚠️ Once this folder changes, update me. -->

Dashboard widget layout and container infrastructure.
Integrates react-grid-layout v2 behavior, moderate-opacity glassmorphism header controls, direct touch edit-mode actions, and plugin widget mounting.
Includes deterministic fallback placement, lower-frequency resize width commits, persistent width measurement across empty states, zero-width mount guards, interaction-scoped local-sync plus commit-persistence layout flows, plugin loading skeleton/fade handling, and forced delete affordances for unavailable widgets.

| File | Role | Description |
|------|------|-------------|
| __tests__/ | Subdirectory | Test cases for modules in this folder. |
| __tests__/DashboardWidgetWrapper.test.tsx | Test suite | Guards against known plugin widgets flashing error UI during idle/loading, verifies unavailable widgets still expose delete actions, and checks loaded-state fade-in wrapping. |
| DashboardGrid.tsx | UI component | Uses RGL v2 `useContainerWidth` (`1w = 1h`) with lower-frequency stabilized width commits, persistent empty-state container mounting so the first added widget appears without refresh, zero-width render guards on tab remount, interaction-scoped local layout sync, drag/resize commit persistence callbacks, and a dedicated unavailable-widget delete channel. |
| DashboardWidgetWrapper.tsx | UI component | Builds plugin header actions with shared moderate-opacity glassmorphism button styling, keeps known lazy plugin widgets on bordered skeletons until runtime registration completes, and preserves delete affordances when widget plugins become unavailable. |
| WidgetContainer.tsx | UI component | Renders widget chrome with single-ring card treatment plus edit-mode-only hover elevation, drag/actions, and direct touch edit-mode header controls with softened, moderate-opacity glassmorphism affordances. |
