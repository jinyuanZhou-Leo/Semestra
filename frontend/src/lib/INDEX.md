<!-- ⚠️ Once this folder changes, update me. -->

Small framework-agnostic helpers shared across UI modules.
Currently contains Tailwind class composition helper(s) plus small browser-safe HTML rendering utilities.
Keep generic utility glue here instead of page-specific files.

| File | Role | Description |
|------|------|-------------|
| html.test.ts | Test file | Verifies safe text/list HTML sanitization keeps common block structure and that Canvas mode preserves page-link metadata plus table/image markup with inline styles. |
| html.ts | HTML utility | Detects HTML-like rich text and sanitizes it either to a safe text/list subset or to a richer allowlist with Canvas page-link data-attribute preservation, table/image support, and retained inline styles for dialog/UI rendering. |
| utils.ts | Utility module | Shared `cn` helper for Tailwind class merging. |
