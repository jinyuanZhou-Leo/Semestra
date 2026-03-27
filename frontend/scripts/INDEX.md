<!-- ⚠️ Once this folder changes, update me. -->

Node scripts used by npm lifecycle commands.
Current scripts write build metadata for the frontend UI and generate the backend plugin setup manifest from frontend-owned setup DSL definitions.
Scripts run before dev/build so version and plugin-system contracts stay in sync across the repository.

| File | Role | Description |
|------|------|-------------|
| generate-version.js | Build script | Generates `src/version.json` from git/version metadata. |
| generate-plugin-setup-manifest.mjs | Build script | Loads the frontend setup registry through Vite SSR and writes `backend/generated/plugin_setup_manifest.json` with stable ordering for backend plugin-system validation. |
