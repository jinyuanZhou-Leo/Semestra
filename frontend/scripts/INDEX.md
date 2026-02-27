<!-- ⚠️ Once this folder changes, update me. -->

Node scripts used by npm lifecycle commands.
Current script writes build metadata consumed by frontend settings UI.
Scripts run before dev/build to keep runtime version info current.

| File | Role | Description |
|------|------|-------------|
| generate-version.js | Build script | Generates `src/version.json` from git/version metadata. |
