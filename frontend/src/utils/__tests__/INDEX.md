<!-- ⚠️ Once this folder changes, update me. -->

Unit tests for pure utility helpers.
Current suite validates auth redirect restoration plus GPA mapping and edge-case parsing behavior.
Keeps deterministic logic covered independent of UI rendering.

| File | Role | Description |
|------|------|-------------|
| authRedirect.test.ts | Test file | Unit tests for remembering, resolving, consuming, and sanitizing post-login redirect targets used during session-expiry recovery. |
| courseCategoryBadge.test.ts | Test file | Unit tests for subject-code parsing, Program subject-color-map normalization, and automatic/default course color resolution. |
| gpaUtils.test.ts | Test file | Unit tests for GPA rule parsing, score mapping, and adjacent integer-band continuity. |
