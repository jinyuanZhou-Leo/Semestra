<!-- ⚠️ Once this folder changes, update me. -->

Generated backend artifacts checked into the repository for runtime consumption.
This folder currently stores the frontend-authored plugin metadata and setup manifests that the backend validates and loads at import time.
Artifacts here are deterministic build outputs and should be regenerated, not edited by hand.

| File | Role | Description |
|------|------|-------------|
| plugin_metadata_manifest.json | Generated manifest | Stable JSON manifest generated from `frontend/src/plugins/*/metadata.ts`, including plugin identity, contexts, and capability flags such as `supports_unassigned_course`, consumed by `backend/plugin_governance.py`. |
| plugin_setup_manifest.json | Generated manifest | Stable JSON manifest generated from `frontend/src/plugins/*/setup.ts` and consumed by `backend/plugin_governance.py` for plugin-system setup definitions. |
