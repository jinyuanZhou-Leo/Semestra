<!-- ⚠️ Once this folder changes, update me. -->

Pure utility functions and small constants used across pages/components.
Includes GPA conversion, GPA-percentage display formatting, password rules, icon guards, Google identity loader, and shared course badge color helpers.
Also contains homepage builtin-tab configuration and widget layout normalization helpers.

| File | Role | Description |
|------|------|-------------|
| __tests__/ | Subdirectory | Test cases for modules in this folder. |
| courseCategoryBadge.ts | Utility module | Shared course color helper that parses subject codes, resolves stable Program default colors plus per-course overrides, reserves persisted assignments while choosing colors for new codes, and provides contrast-safe hex badge styles reused by ProgramDashboard, Course List, Course Settings, Todo, and Gradebook. |
| googleIdentity.ts | Utility module | Lazy loader for Google Identity Services script. |
| gpaUtils.ts | Utility module | GPA conversion helpers and default scaling table constants. |
| homepageBuiltinTabs.ts | Utility module | Homepage builtin-tab requirements/config constants that pin Dashboard first and Settings last while leaving Gradebook, Calendar, Schedule, and Todo reorderable. |
| icon.ts | Utility module | Type guard for icon values that should render as images. |
| passwordRules.ts | Utility module | Password validation rules and helper hint text. |
| percentage.ts | Utility module | Shared one-decimal GPA percentage formatters reused by pages, components, and plugins without coupling plugin runtime code to host views. |
| widgetLayout.ts | Utility module | Shared widget layout constraint and size normalization helpers. |
