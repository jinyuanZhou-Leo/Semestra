<!-- ⚠️ Once this folder changes, update me. -->

Generated plugin manifest artifacts for backend plugin discovery.
Files in this folder are build outputs from `frontend/scripts/generate-plugin-manifests.ts`, not handwritten sources.
The backend reads `*.plugin.json` and optional `*.setup.schema.json` here, both generated from frontend `plugins/*/plugin.ts` authoring entries, while `host-policy.json` remains authored under `frontend/src/plugins/`.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Explains the generated plugin-manifest artifact contract and ownership. |
| `*.plugin.json` | Generated manifest | Backend-readable plugin descriptor emitted from each plugin's `plugin.ts` authoring entry. |
| `*.setup.schema.json` | Generated setup schema | Backend-readable setup schema emitted only for plugins that export `setup.schema`. |
