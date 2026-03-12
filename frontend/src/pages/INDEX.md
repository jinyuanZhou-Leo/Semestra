<!-- ⚠️ Once this folder changes, update me. -->

Route-level page components bound by React Router.
Includes auth screens, a separate marketing landing page, and program/semester/course workspaces.
Each page composes shared contexts, hooks, components, and service APIs.

| File | Role | Description |
|------|------|-------------|
| CourseHomepage.tsx | Route page | Course workspace route with compact workspace navigation, parent-context breadcrumb handling, Program-derived default course colors in settings, gradebook-owned course stats, focus-safe add-widget/add-tab overlay triggers, visible-tab settings runtime preloading, terminal missing-plugin settings fallbacks, unavailable-widget force cleanup, shared wheel-driven horizontal tab scrolling, and tab content fade-in on every active-tab switch. |
| HomePage.tsx | Route page | Home workspace route with responsive create-program surface (desktop dialog + mobile drawer) and program overview cards. |
| LandingPage.tsx | Route page | Public marketing page mounted only on `/landing`, separate from the product-first root entry flow. |
| LoginPage.tsx | Route page | Login route that exchanges credentials or Google identity for a cookie-backed session before bootstrapping the auth context. |
| ProgramDashboard.tsx | Route page | Program workspace route with compact mobile overview stat strip, responsive create-semester surface, modal-based program settings that auto-save without an explicit save button, Program-level subject-color management, and shared course tag colors reused by Course List and Todo. |
| RegisterPage.tsx | Route page | Registration route that creates an account, exchanges credentials or Google identity for a cookie-backed session, and bootstraps auth state. |
| SemesterHomepage.tsx | Route page | Semester workspace route with compact workspace navigation, parent-context breadcrumb handling, dashboard-only overview stats, focus-safe add-widget/add-tab overlay triggers, visible-tab settings runtime preloading, terminal missing-plugin settings fallbacks, unavailable-widget force cleanup, shared wheel-driven horizontal tab scrolling, tab fade transitions, and semester settings including Reading Week persistence. |
| SettingsPage.tsx | Route page | Settings workspace route with debounced auto-save feedback for global defaults, responsive appearance controls, backup restore drag-drop dialog flow, overflow-safe account/version text on mobile, and account sign-out wiring. |
