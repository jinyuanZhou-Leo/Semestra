<!-- ⚠️ Once this folder changes, update me. -->

Node scripts used by npm lifecycle commands.
Current scripts write build metadata for the frontend UI and generate backend-readable plugin manifest artifacts.
Plugin metadata is authored inline in `frontend/src/plugins/*/plugin.ts`, while `generate-plugin-manifests.ts` builds those entries and emits backend JSON into `backend/generated/plugin-manifests/`.

| File | Role | Description |
|------|------|-------------|
| generate-plugin-manifests.ts | Build script | Builds typed plugin authoring entries, then serializes backend plugin manifests and optional setup schemas into deterministic JSON artifacts. |
| generate-version.js | Build script | Generates `src/version.json` from git/version metadata. |
