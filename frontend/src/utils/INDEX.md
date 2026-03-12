<!-- ⚠️ Once this folder changes, update me. -->

Pure utility functions and small constants used across pages/components.
Includes GPA conversion, password rules, icon guards, Google identity loader, and shared course badge color helpers.
Also contains homepage builtin-tab configuration and widget layout normalization helpers.

| File | Role | Description |
|------|------|-------------|
| __tests__/ | Subdirectory | Test cases for modules in this folder. |
| courseCategoryBadge.ts | Utility module | Shared course badge helper that supports persisted per-course hex colors plus distinct fallback colors reused by ProgramDashboard and Todo course tags. |
| googleIdentity.ts | Utility module | Lazy loader for Google Identity Services script. |
| gpaUtils.ts | Utility module | GPA conversion helpers and default scaling table constants. |
| homepageBuiltinTabs.ts | Utility module | Builtin homepage tab ordering/config constants, including the course Gradebook tab position. |
| icon.ts | Utility module | Type guard for icon values that should render as images. |
| passwordRules.ts | Utility module | Password validation rules and helper hint text. |
| widgetLayout.ts | Utility module | Shared widget layout constraint and size normalization helpers. |
