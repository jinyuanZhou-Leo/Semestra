<!-- ⚠️ Once this folder changes, update me. -->

Generated backend artifact folder for build-produced metadata that backend startup and migrations can consume without importing frontend code.
Plugin manifest artifacts now live under `plugin-manifests/` and are generated from typed frontend `plugin.ts` authoring files.
The backend still reads host-only visibility/kind policy from `frontend/src/plugins/host-policy.json`.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Notes the purpose and ownership of backend generated artifacts. |
| plugin-manifests/ | Generated manifests | Backend-readable plugin descriptor and setup-schema JSON emitted from typed frontend single-entry plugin definitions. |
