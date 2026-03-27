<!-- ⚠️ Once this folder changes, update me. -->

Generated backend artifacts checked into the repository for runtime consumption.
This folder currently stores the frontend-authored plugin setup manifest that the backend validates and loads at import time.
Artifacts here are deterministic build outputs and should be regenerated, not edited by hand.

| File | Role | Description |
|------|------|-------------|
| plugin_setup_manifest.json | Generated manifest | Stable JSON manifest generated from `frontend/src/plugins/*/setup.ts` and consumed by `backend/plugin_governance.py` for plugin-system setup definitions. |
