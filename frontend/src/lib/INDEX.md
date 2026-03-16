<!-- ⚠️ Once this folder changes, update me. -->

Small framework-agnostic helpers shared across UI modules.
Currently contains Tailwind class composition helper(s) plus small browser-safe HTML rendering utilities.
Keep generic utility glue here instead of page-specific files.

| File | Role | Description |
|------|------|-------------|
| html.ts | HTML utility | Detects HTML-like rich text and sanitizes it to a safe allowlist with limited inline-style preservation for dialog/UI rendering. |
| utils.ts | Utility module | Shared `cn` helper for Tailwind class merging. |
