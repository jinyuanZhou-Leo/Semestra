<!-- ⚠️ Once this folder changes, update me. -->

Node scripts used by npm lifecycle commands.
Current scripts only write build metadata for the frontend UI.
Plugin descriptors now live in `frontend/src/plugins/*/plugin.json` and `setup.schema.json`, so dev/build no longer generate backend plugin manifests.

| File | Role | Description |
|------|------|-------------|
| generate-version.js | Build script | Generates `src/version.json` from git/version metadata. |
