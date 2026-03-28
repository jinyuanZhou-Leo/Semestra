<!-- ⚠️ Once this folder changes, update me. -->

Cross-page hooks for data sync, dashboard state, and UI responsiveness.
Contains Query-backed entity/resource access plus governed runtime tab/widget orchestration with context-change cancellation guards.
Includes stale-request-safe fetch primitives, framework-managed plugin shared-settings autosave seeded from resolved config, shared gradebook/todo query hooks, backend-backed runtime tab order/settings sync, and force-aware cleanup for unavailable widgets.

| File | Role | Description |
|------|------|-------------|
| __tests__/ | Subdirectory | Test cases for modules in this folder. |
| useAutoSave.ts | Hook module | Shared settings auto-save scheduler with structural snapshot comparison, debounce/max-wait throttling, validation gates, save-state feedback, pause-after-error behavior until the draft changes again, and browser-safe timer handle typing for mixed DOM/Node TS environments. |
| useCourseGradebookQuery.ts | Hook module | Shared TanStack Query hook pair for course gradebook reads plus cache-updating mutations reused by Gradebook tab/settings surfaces. |
| use-mobile.ts | Hook module | Mobile breakpoint hook (640px) with immediate client-side width initialization to avoid first-frame responsive surface mismatches. |
| useAppStatus.ts | Hook module | Custom hook implementing use app status behavior. |
| useDashboardTabs.ts | Hook module | Orchestrates Program/Semester-governed runtime tabs with optimistic local state, debounced tab-type settings sync, and Semester-owned order persistence. |
| useDashboardWidgets.ts | Hook module | Orchestrates widget CRUD, unavailable-widget force cleanup, resilient settings/layout parsing, context-key reset safeguards, and split local layout sync with parallelized commit persistence. |
| useDataFetch.ts | Hook module | Generic fetch hook with loading/error state plus stale-response guards to prevent older requests from overwriting newer state. |
| useEntityContext.ts | Hook module | Generic optimistic entity-sync hook that now stores entity state in TanStack Query cache while keeping debounced persistence and entity-switch guards for pending update queues. |
| useHomepageBuiltinTabs.ts | Hook module | Homepage tab orchestration that consumes governed runtime tabs, hides persisted plugin tabs when their owning plugin is disabled upstream, synthesizes Dashboard and Settings shell tabs from enabled plugins when backend rows are missing, keeps those shell tabs pinned, and preserves user reordering for the remaining tabs. |
| usePluginSharedSettings.ts | Hook module | Loads one plugin-level shared-settings record from shared Query cache, seeds from resolved runtime config when present, and syncs updates through framework autosave with debounce and max-wait forcing. |
| usePrefersReducedMotion.ts | Hook module | Accessibility helper for `(prefers-reduced-motion)` that now safely falls back when `matchMedia` is unavailable in non-browser or stripped test environments. |
| useScrollProgress.ts | Hook module | Custom hook implementing use scroll progress behavior. |
| useSemesterTodoQuery.ts | Hook module | Shared TanStack Query hook pair for semester todo reads plus cache lookups/writes reused by Todo and Calendar-adjacent flows. |
| useStickyCollapse.ts | Hook module | Custom hook implementing use sticky collapse behavior. |
| useTouchDevice.ts | Hook module | Custom hook implementing use touch device behavior. |
| useVisibleTabSettingsPreload.ts | Hook module | Preloads visible tab runtimes so inactive tabs can still expose instance settings inside the Settings page. |
