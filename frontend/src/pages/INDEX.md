<!-- ⚠️ Once this folder changes, update me. -->

Route-level page components bound by React Router.
Includes auth screens, a separate marketing landing page, and program/semester/course workspaces with shared semantic empty-state treatment.
Each page composes shared contexts, hooks, components, and service APIs.

| File | Role | Description |
|------|------|-------------|
| CourseHomepage.tsx | Route page | Course workspace route with compact workspace navigation, parent-context breadcrumb handling, Program-derived default course colors in settings, gradebook-owned course stats, focus-safe add-widget/add-tab overlay triggers, visible-tab settings runtime preloading, terminal missing-plugin settings fallbacks, unavailable-widget force cleanup, course-aware widget settings context passthrough, shared wheel-driven horizontal tab scrolling, tab content fade-in on every active-tab switch, and settings autosave that now flushes through the shared immediate course-commit path instead of hand-rolled refresh cycles. |
| HomePage.tsx | Route page | Home workspace route with responsive create-program surface (desktop dialog + mobile drawer), program overview cards, and a standardized create empty state. |
| LandingPage.tsx | Route page | Public marketing page mounted only on `/landing`, separate from the product-first root entry flow. |
| LoginPage.tsx | Route page | Login route that exchanges credentials or Google identity for a cookie-backed session before bootstrapping the auth context. |
| ProgramDashboard.tsx | Route page | Program workspace route with compact mobile overview stat strip, responsive create-semester surface, modal-based program settings that auto-save and flush on close through the shared immediate program-commit path, Program-level subject-color management, shared course tag colors reused by Course List and Todo, tri-state All Courses sorting that cycles original/ascending/descending order, and standardized not-found fallbacks. |
| RegisterPage.tsx | Route page | Registration route that creates an account, exchanges credentials or Google identity for a cookie-backed session, and bootstraps auth state. |
| SemesterHomepage.tsx | Route page | Semester workspace route with compact workspace navigation, parent-context breadcrumb handling, dashboard-only overview stats, focus-safe add-widget/add-tab overlay triggers, visible-tab settings runtime preloading, terminal missing-plugin settings fallbacks, unavailable-widget force cleanup, semester-aware widget settings context passthrough, shared wheel-driven horizontal tab scrolling, tab fade transitions, semester settings including Reading Week persistence through the shared immediate semester-commit path, and standardized unavailable/not-found empty states. |
| SettingsPage.tsx | Route page | Settings workspace route with debounced auto-save feedback for global defaults, background plugin idle-preload preference persistence, responsive appearance controls, backup restore drag-drop dialog flow, overflow-safe account/version text on mobile, and account sign-out wiring. |
