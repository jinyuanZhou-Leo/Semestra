<!-- ⚠️ Once this folder changes, update me. -->

Cross-page hooks for data sync, dashboard state, and UI responsiveness.
Contains domain hooks plus compatibility wrappers that now re-export app-side data resources from `src/data/resources`.
Includes stale-request-safe fetch primitives, governed runtime tab/widget orchestration, backend-backed runtime tab order/settings sync, host-reserved homepage shell-tab orchestration, and force-aware cleanup for unavailable widgets.

| File | Role | Description |
|------|------|-------------|
| __tests__/ | Subdirectory | Test cases for modules in this folder. |
| useAutoSave.ts | Hook module | Shared settings auto-save scheduler with structural snapshot comparison, debounce/max-wait throttling, validation gates, save-state feedback, pause-after-error behavior until the draft changes again, browser-safe timer handle typing for mixed DOM/Node TS environments, and direct `flush()` rejection so navigation/finalize flows can fail closed instead of silently advancing after a save error. |
| useCourseGradebookQuery.ts | Hook module | Compatibility re-export for Course gradebook hooks that now live in the app-side data resource layer. |
| useCourseScheduleQueries.ts | Hook module | Compatibility re-export for Course schedule query builders, hooks, and invalidation helpers now owned by `src/data/resources/courseSchedule.ts`. |
| use-mobile.ts | Hook module | Mobile breakpoint hook (640px) with immediate client-side width initialization to avoid first-frame responsive surface mismatches. |
| useAppStatus.ts | Hook module | Custom hook implementing use app status behavior. |
| useDashboardTabs.ts | Hook module | Orchestrates Program/Semester-governed runtime tabs with optimistic local state, debounced tab-type settings sync, per-key inherited-setting source metadata updates for reset/source badges, Semester-owned or unassigned-Course-owned order persistence, and manifest-title fallback for legacy tab rows while current runtime-tab write/order flows consume API-normalized tab objects. |
| useDashboardWidgets.ts | Hook module | Orchestrates widget CRUD, unavailable-widget force cleanup, resilient settings/layout parsing, context-key reset safeguards, and split local layout sync with parallelized commit persistence. |
| useDataFetch.ts | Hook module | Generic fetch hook with loading/error state plus stale-response guards to prevent older requests from overwriting newer state. |
| useEntityContext.ts | Hook module | Generic optimistic entity-sync hook that now stores entity state in TanStack Query cache while keeping debounced persistence and entity-switch guards for pending update queues. |
| useHomepageBuiltinTabs.ts | Hook module | Homepage tab orchestration that consumes governed runtime tabs, keeps host-reserved Dashboard and Settings shell tabs pinned even when synthesized by the host, and preserves user reordering for the remaining tabs without treating shell tabs as ordinary plugin contributions. |
| usePrefersReducedMotion.ts | Hook module | Accessibility helper for `(prefers-reduced-motion)` that now safely falls back when `matchMedia` is unavailable in non-browser or stripped test environments. |
| useScrollProgress.ts | Hook module | Custom hook implementing use scroll progress behavior. |
| useSemesterTodoQuery.ts | Hook module | Compatibility re-export for Semester todo hooks that now live in the app-side data resource layer. |
| useStickyCollapse.ts | Hook module | Custom hook implementing use sticky collapse behavior. |
| useTouchDevice.ts | Hook module | Custom hook implementing use touch device behavior. |
| useVisibleTabSettingsPreload.ts | Hook module | Preloads visible tab runtimes so inactive tabs can still expose instance settings inside the Settings page. |
| useWorkspaceEntityQueries.ts | Hook module | Compatibility re-export for shared Program/Semester/Course entity query builders and hooks now owned by `src/data/resources/workspaceEntities.ts`. |
