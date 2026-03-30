<!-- ⚠️ Once this folder changes, update me. -->

Generated backend artifact folder retained only as a placeholder after the descriptor-first plugin refactor.
The old frontend-generated manifests were removed because runtime plugin management no longer consumes generated metadata.
The backend now reads `frontend/src/plugins/*/plugin.json` and optional `setup.schema.json` directly.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Notes that runtime plugin management no longer uses generated manifest artifacts in this folder. |
