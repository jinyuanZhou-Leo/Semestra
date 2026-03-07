<!-- ⚠️ Once this folder changes, update me. -->

Route-level page components bound by React Router.
Includes auth screens, a separate marketing landing page, and program/semester/course workspaces.
Each page composes shared contexts, hooks, components, and service APIs.

| File | Role | Description |
|------|------|-------------|
| CourseHomepage.tsx | Route page | Course workspace route that wires dashboard widgets with split layout local-sync/commit persistence callbacks, non-wrapping/truncating breadcrumb placeholders, focus-safe add-widget/add-tab overlay triggers, and tab content fade-in on every active-tab switch. |
| HomePage.tsx | Route page | Home workspace route with responsive create-program surface (desktop dialog + mobile drawer) and program overview cards. |
| LandingPage.tsx | Route page | Public marketing page mounted only on `/landing`, separate from the product-first root entry flow. |
| LoginPage.tsx | Route page | Page component for the login page route workflow. |
| ProgramDashboard.tsx | Route page | Program workspace route with compact mobile overview stat strip plus responsive create-semester surface (desktop dialog + mobile drawer). |
| RegisterPage.tsx | Route page | Page component for the register page route workflow. |
| SemesterHomepage.tsx | Route page | Semester workspace route that wires dashboard widgets with split layout local-sync/commit persistence callbacks, non-wrapping/truncating breadcrumb placeholders, focus-safe add-widget/add-tab overlay triggers, and tab content fade-in on every active-tab switch. |
| SettingsPage.tsx | Route page | Settings workspace route with responsive wrapping for appearance controls and overflow-safe account/version text on mobile. |
