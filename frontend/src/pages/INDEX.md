<!-- ⚠️ Once this folder changes, update me. -->

Route-level page components bound by React Router.
Includes auth screens, landing page, and program/semester/course workspaces.
Each page composes shared contexts, hooks, components, and service APIs.

| File | Role | Description |
|------|------|-------------|
| CourseHomepage.tsx | Route page | Course workspace route that wires dashboard widgets with split layout local-sync/commit persistence callbacks, a non-wrapping/truncating breadcrumb with loading placeholders, collapsible hero stats beneath the heading, and a shrink-state tab selector that translates right/up beside the title in sync with stat collapse. |
| HomePage.tsx | Route page | Page component for the home page route workflow. |
| LandingPage.tsx | Route page | Page component for the landing page route workflow. |
| LoginPage.tsx | Route page | Page component for the login page route workflow. |
| ProgramDashboard.tsx | Route page | Program workspace route with a compact SemesterHomepage-style mobile overview stat strip to keep the semester list visible earlier while preserving desktop card layout behavior. |
| RegisterPage.tsx | Route page | Page component for the register page route workflow. |
| SemesterHomepage.tsx | Route page | Semester workspace route that wires dashboard widgets with split layout local-sync/commit persistence callbacks, a non-wrapping/truncating breadcrumb with loading placeholders, collapsible hero stats beneath the heading, and a shrink-state tab selector that translates right/up beside the title in sync with stat collapse. |
| SettingsPage.tsx | Route page | Settings workspace route with responsive wrapping for appearance controls and overflow-safe account/version text on mobile. |
