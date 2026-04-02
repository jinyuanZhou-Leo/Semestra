<!-- ⚠️ Once this folder changes, update me. -->

Pure utility functions and small constants used across pages/components.
Includes auth redirect restoration, GPA conversion, GPA-percentage display formatting, password rules, icon guards, Google identity loader, shared course badge color helpers, and Program Home Focus Board state helpers.
Also contains homepage host-reserved tab configuration and widget layout normalization helpers.

| File | Role | Description |
|------|------|-------------|
| __tests__/ | Subdirectory | Test cases for modules in this folder. |
| authRedirect.ts | Utility module | Persists and resolves the last valid in-app route so session-expired re-login can return users to the page they were using instead of always landing on `/`. |
| courseCategoryBadge.ts | Utility module | Shared course color helper that parses subject codes, resolves stable Program default colors plus per-course overrides, reserves persisted assignments while choosing colors for new codes, and provides contrast-safe hex badge styles reused by ProgramDashboard, Course List, Course Settings, Todo, and Gradebook. |
| googleIdentity.ts | Utility module | Lazy loader for Google Identity Services script. |
| gpaUtils.ts | Utility module | GPA conversion helpers and default scaling table constants, including continuous matching for adjacent integer-authored bands. |
| homepageBuiltinTabs.ts | Utility module | Homepage shell-tab config constants plus host-reserved tab/plugin identifiers that pin Dashboard and Settings around user-managed workspace tabs without treating them as public plugin contributions. |
| icon.ts | Utility module | Type guard for icon values that should render as images. |
| passwordRules.ts | Utility module | Password validation rules and helper hint text. |
| percentage.ts | Utility module | Shared one-decimal GPA percentage formatters reused by pages, components, and plugins without coupling plugin runtime code to host views. |
| programHome.ts | Utility module | Shared Program Home Focus Board config parser, serializer, pin helpers, fixed card-dimension helpers, and deterministic layout/sort builders reused by Program Home and Semester/Course settings. |
| widgetLayout.ts | Utility module | Shared widget layout constraint and size normalization helpers. |
