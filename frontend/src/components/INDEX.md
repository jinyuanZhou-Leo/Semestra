<!-- ⚠️ Once this folder changes, update me. -->

Reusable UI building blocks shared by pages and plugin containers.
Includes modal workflows, settings panels, dashboard/tab shells, and theme helpers.
`ui/` holds shadcn primitives and is intentionally excluded from this documentation scope.

| File | Role | Description |
|------|------|-------------|
| __tests__/ | Subdirectory | Test cases for modules in this folder. |
| landing/ | Subdirectory | Landing-page-only presentational components. |
| settings/ | Subdirectory | Reserved settings sub-components area. |
| skeletons/ | Subdirectory | Loading skeleton component set. |
| ui/ | Subdirectory | shadcn UI primitives (excluded from this documentation scope per request). |
| widgets/ | Subdirectory | Dashboard widget layout/container infrastructure, including single-ring card-aligned widget chrome, edit-mode-only hover elevation, and forced delete affordances when plugin widgets become unavailable. |
| AddTabModal.tsx | UI component | Reusable add-tab selector using desktop dialog and mobile drawer presentation. |
| AddWidgetModal.tsx | UI component | Reusable add-widget selector using desktop dialog and mobile drawer presentation. |
| AnimatedNumber.tsx | UI component | Reusable component for animated number UI/interaction flow. |
| BackButton.tsx | UI component | Reusable component for back button UI/interaction flow. |
| Container.tsx | UI component | Reusable component for container UI/interaction flow. |
| CrudPanel.tsx | CRUD shell | Reusable panel/table wrapper for settings management surfaces. Provides `CrudPanel`, `TableShell`, `PanelHeader`, and `EmptyTableRow` sub-exports. |
| CourseManagerModal.tsx | UI component | Reusable add-course manager using desktop dialog and mobile drawer presentation. |
| CourseSettingsPanel.tsx | UI component | Course settings panel with debounced auto-save, pending-save feedback, and draft-safe sync against backend refreshes. |
| GPAScalingTable.tsx | UI component | Reusable component for g p a scaling table UI/interaction flow. |
| GradientBlinds.css | Stylesheet | Reusable component for gradient blinds UI/interaction flow. |
| GradientBlinds.tsx | UI component | Reusable component for gradient blinds UI/interaction flow. |
| IconCircle.tsx | UI component | Reusable component for icon circle UI/interaction flow. |
| ImportPreviewModal.tsx | UI component | Reusable component for import preview modal UI/interaction flow. |
| KeyValueTable.tsx | UI component | Reusable component for key value table UI/interaction flow. |
| Layout.tsx | UI component | Shared authenticated layout chrome, including header breadcrumb slot, fixed-height overflow handling, and server-backed sign-out actions. |
| PageSkeleton.tsx | UI component | Reusable component for page skeleton UI/interaction flow. |
| PluginSettingsCard.tsx | UI component | Reusable component for plugin settings card UI/interaction flow. |
| ProgramSettingsPanel.tsx | UI component | Program settings panel with debounced auto-save, JSON validation feedback, and draft-safe sync against optimistic program updates. |
| ResponsiveDialogDrawer.tsx | UI component | Shared responsive overlay wrapper that renders desktop dialog and mobile drawer, with unified header/footer slots and open-time focus handoff. |
| RequireAuth.tsx | UI component | Reusable component for require auth UI/interaction flow. |
| SaveSettingButton.tsx | UI component | Legacy animated save CTA retained for non-auto-save settings flows. |
| SemesterSettingsPanel.tsx | UI component | Semester settings panel with debounced auto-save, Reading Week validation, and draft-safe sync against refreshed semester payloads. |
| SessionExpiredModal.tsx | UI component | Reusable component for session expired modal UI/interaction flow. |
| SettingsModal.tsx | UI component | Reusable component for settings modal UI/interaction flow. |
| SettingsSection.tsx | UI component | Reusable settings section wrapper with sticky left-side titles that can inherit a page-level offset provider. |
| SettingsTabContent.tsx | UI component | Reusable component for settings tab content UI/interaction flow. |
| Tabs.tsx | UI component | Reusable dashboard/homepage tab shell with drag-sort, add/remove controls, overflow scrolling, and stable right-aligned workspace navigation behavior. |
| TabSwitch.tsx | UI component | Reusable component for tab switch UI/interaction flow. |
| ThemeProvider.tsx | UI component | Reusable component for theme provider UI/interaction flow. |
| ThemeToggle.tsx | UI component | Reusable component for theme toggle UI/interaction flow. |
| WidgetSettingsModal.tsx | UI component | Widget-settings modal that preserves the active widget payload through close animations and commits edits on explicit save. |
| WorkspaceNav.tsx | UI component | Shared sticky workspace navigation row that pairs semester/course context with the homepage tab switcher and extra-large mobile workspace titles. |
| WorkspaceOverviewStats.tsx | UI component | Compact dashboard-only stat strip using normal labels and optional icons after workspace titles move out of page heroes, with tighter mobile card height. |
