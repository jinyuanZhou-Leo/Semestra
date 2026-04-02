<!-- ⚠️ Once this folder changes, update me. -->

App-side TanStack data layer for host resources only.
Splits stable query keys from resource modules so pages and contexts stop hand-writing cache wiring.
Keeps plugin-facing compatibility exports outside this folder.

| File | Role | Description |
|------|------|-------------|
| keys/ | Subdirectory | Split Program/Semester/Course/User query-key registries plus an aggregated barrel for app-side callers. |
| resources/ | Subdirectory | App-side resource modules that centralize query option builders, hooks, and cache invalidation helpers for host pages, contexts, and settings surfaces. |
