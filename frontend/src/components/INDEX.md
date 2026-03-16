<!-- ⚠️ Once this folder changes, update me. -->

Reusable UI building blocks shared by pages and plugin containers.
Includes modal workflows, settings panels, dashboard/tab shells, theme helpers, and business-layer empty-state wrappers.
`ui/` holds shadcn primitives and is intentionally excluded from this documentation scope.

| File | Role | Description |
|------|------|-------------|
| __tests__/ | Subdirectory | Test cases for modules in this folder. |
| landing/ | Subdirectory | Landing-page-only presentational components. |
| settings/ | Subdirectory | Settings-specific component groupings such as LMS integration management plus local provider-definition helpers that keep provider-specific wiring out of generic settings components. |
| skeletons/ | Subdirectory | Loading skeleton component set. |
| ui/ | Subdirectory | shadcn UI primitives (excluded from this documentation scope per request). |
| widgets/ | Subdirectory | Dashboard widget layout/container infrastructure, including single-ring card-aligned widget chrome, edit-mode-only hover elevation, and forced delete affordances when plugin widgets become unavailable. |
| AppEmptyState.tsx | UI component | Business-layer empty-state wrapper that standardizes scenario-based create, no-results, not-found, and unavailable states while composing shadcn `Empty` primitives without modifying `components/ui`. |
| AddTabModal.tsx | UI component | Reusable add-tab selector using desktop dialog and mobile drawer presentation. |
| AddWidgetModal.tsx | UI component | Reusable add-widget selector using desktop dialog and mobile drawer presentation. |
| AnimatedNumber.tsx | UI component | Reusable component for animated number UI/interaction flow. |
| BackButton.tsx | UI component | Reusable component for back button UI/interaction flow. |
| Container.tsx | UI component | Reusable component for container UI/interaction flow. |
| CrudPanel.tsx | CRUD shell | Reusable panel/table wrapper for settings management surfaces with mobile-safe header stacking and overflow-contained horizontal table scrolling. Provides `CrudPanel`, `TableShell`, `PanelHeader`, and `EmptyTableRow` sub-exports. |
| CourseManagerModal.tsx | UI component | Reusable add-course manager using desktop dialog and mobile drawer presentation, with height-stable select/create/calendar/LMS tabs, searchable existing-course selection, duplicate-name confirmation before manual creation, ICS parsing import, reusable LMS search-plus-year-filter course selection, split loading feedback, and standardized modal no-results empty states. |
| CourseSettingsPanel.tsx | UI component | Course settings panel with debounced auto-save, close/unmount flush protection, shadcn `Field`-based standard form layout, right-aligned switch controls, Program-derived default-color guidance, optional per-course override controls, a clearer LMS status card with adjacent sync/disconnect actions, inline link-update controls, destructive disconnect confirmation, and a caller-provided immediate commit callback so autosave timing stays outside the data layer. |
| GPAScalingTable.tsx | UI component | GPA scaling-rule editor with descending range sorting, explicit min/max/GPA inputs, full-range coverage warnings, and standardized create-empty feedback when no rules exist yet. |
| GradientBlinds.css | Stylesheet | Reusable component for gradient blinds UI/interaction flow. |
| GradientBlinds.tsx | UI component | Reusable component for gradient blinds UI/interaction flow. |
| IconCircle.tsx | UI component | Reusable component for icon circle UI/interaction flow. |
| ImportPreviewModal.tsx | UI component | Backup-restore preview modal that summarizes programs, Program-level courses, LMS integrations, todo tasks, resources, and schedule-bearing course data while still handling conflict strategy and optional account-settings import. |
| KeyValueTable.tsx | UI component | Reusable component for key value table UI/interaction flow. |
| Layout.tsx | UI component | Shared authenticated layout chrome, including header breadcrumb slot, fixed-height overflow handling, and server-backed sign-out actions. |
| LmsCourseSelectionList.tsx | UI component | Reusable LMS multi-select list with shadcn-native search/select chrome, linked-course disabled states with inline reasons, a single input-radius results shell, unclipped focus rings, and overflow-safe scrollable rows for Add Course/Add Semester flows. |
| PageSkeleton.tsx | UI component | Reusable component for page skeleton UI/interaction flow. |
| PluginSettingsCard.tsx | UI component | Reusable component for plugin settings card UI/interaction flow. |
| ProgramSettingsPanel.tsx | UI component | Program settings panel with debounced auto-save, close/unmount flush protection, separated General and LMS sections, Program-level LMS integration selection/lock behavior, discovered-code CRUD-style color management, persisted stable subject-color assignments that reserve existing colors for future codes, JSON validation feedback, and draft-safe sync against optimistic program updates. |
| ResponsiveDialogDrawer.tsx | UI component | Shared responsive overlay wrapper that renders desktop dialog and mobile drawer, with unified header/footer slots, optional built-in desktop close control, and open-time focus handoff. |
| RequireAuth.tsx | UI component | Reusable component for require auth UI/interaction flow. |
| StatusButton.tsx | UI component | Reusable in-place action-status button for save/validate flows with idle, loading, success, and error labels. |
| SemesterSettingsPanel.tsx | UI component | Semester settings panel with debounced auto-save, close/unmount flush protection, shadcn `Field`-based standard form layout, inline Reading Week validation, draft-safe sync against refreshed semester payloads, and a caller-provided immediate commit callback so autosave timing stays outside the data layer. |
| SessionExpiredModal.tsx | UI component | Reusable component for session expired modal UI/interaction flow. |
| SettingsModal.tsx | UI component | Generic settings modal container with a wider desktop surface, fixed header, scrollable body, and async close handling so settings editors can flush pending autosaves before dismissing. |
| SettingsSection.tsx | UI component | Reusable settings section wrapper with sticky left-side titles, shrink-safe content columns, and overflow-contained cards for mobile settings layouts. |
| SettingsTabContent.tsx | UI component | Reusable component for settings tab content UI/interaction flow. |
| Tabs.tsx | UI component | Reusable dashboard/homepage tab shell with non-passive wheel-driven horizontal overflow scrolling, drag-sort, add/remove controls, edge-shadow overflow affordances, and stable right-aligned workspace navigation behavior. |
| TabSwitch.tsx | UI component | Reusable component for tab switch UI/interaction flow. |
| ThemeProvider.tsx | UI component | Reusable component for theme provider UI/interaction flow. |
| ThemeToggle.tsx | UI component | Reusable component for theme toggle UI/interaction flow. |
| WidgetSettingsModal.tsx | UI component | Widget-settings modal that preserves the active widget payload through close animations, passes course/semester context into widget settings UIs, and commits edits on explicit save through the shared status-button feedback pattern. |
| WorkspaceNav.tsx | UI component | Shared sticky workspace navigation row that pairs semester/course context with the homepage tab switcher and extra-large mobile workspace titles. |
| WorkspaceOverviewStats.tsx | UI component | Compact dashboard-only stat strip using normal labels and optional icons after workspace titles move out of page heroes, with tighter mobile card height. |
