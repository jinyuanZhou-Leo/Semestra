<!-- ⚠️ Once this folder changes, update me. -->

Route-level page components bound by React Router.
Includes auth screens, landing page, and program/semester/course workspaces.
Each page composes shared contexts, hooks, components, and service APIs.

| File | Role | Description |
|------|------|-------------|
| CourseHomepage.tsx | Route page | Course workspace route that wires dashboard widgets with split layout local-sync/commit persistence callbacks, non-wrapping/truncating breadcrumb placeholders, and focus-safe add-widget/add-tab overlay triggers. |
| HomePage.tsx | Route page | Home workspace route with responsive create-program surface (desktop dialog + mobile drawer) and program overview cards. |
| LandingPage.tsx | Route page | Page component for the landing page route workflow. |
| LoginPage.tsx | Route page | Page component for the login page route workflow. |
| ProgramDashboard.tsx | Route page | Program workspace route with compact mobile overview stat strip plus responsive create-semester surface (desktop dialog + mobile drawer). |
| RegisterPage.tsx | Route page | Page component for the register page route workflow. |
| SemesterHomepage.tsx | Route page | Semester workspace route that wires dashboard widgets with split layout local-sync/commit persistence callbacks, non-wrapping/truncating breadcrumb placeholders, and focus-safe add-widget/add-tab overlay triggers. |
| SettingsPage.tsx | Route page | Settings workspace route with responsive wrapping for appearance controls and overflow-safe account/version text on mobile. |
