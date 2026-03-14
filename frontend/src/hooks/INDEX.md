<!-- ⚠️ Once this folder changes, update me. -->

Cross-page hooks for data sync, dashboard state, and UI responsiveness.
Contains Query-backed entity/resource access plus optimistic CRUD orchestration for tabs/widgets with context-change cancellation guards.
Includes stale-request-safe fetch primitives, framework-managed plugin shared-settings autosave, shared gradebook/todo query hooks, parallelized order/layout backend synchronization logic, and force-aware cleanup for unavailable widgets.

| File | Role | Description |
|------|------|-------------|
| __tests__/ | Subdirectory | Test cases for modules in this folder. |
| useAutoSave.ts | Hook module | Shared settings auto-save scheduler with structural snapshot comparison, debounce/max-wait throttling, validation gates, and save-state feedback. |
| useCourseGradebookQuery.ts | Hook module | Shared TanStack Query hook pair for course gradebook reads plus cache-updating mutations reused by Gradebook tab/settings surfaces. |
| use-mobile.ts | Hook module | Mobile breakpoint hook (640px) with immediate client-side width initialization to avoid first-frame responsive surface mismatches. |
| useAppStatus.ts | Hook module | Custom hook implementing use app status behavior. |
| useDashboardTabs.ts | Hook module | Orchestrates tab CRUD with optimistic state, debounced settings sync, context-key reset safeguards, and parallelized order persistence retries. |
| useDashboardWidgets.ts | Hook module | Orchestrates widget CRUD, unavailable-widget force cleanup, resilient settings/layout parsing, context-key reset safeguards, and split local layout sync with parallelized commit persistence. |
| useDataFetch.ts | Hook module | Generic fetch hook with loading/error state plus stale-response guards to prevent older requests from overwriting newer state. |
| useEntityContext.ts | Hook module | Generic optimistic entity-sync hook that now stores entity state in TanStack Query cache while keeping debounced persistence and entity-switch guards for pending update queues. |
| useHomepageBuiltinTabs.ts | Hook module | Homepage tab orchestration that ensures required builtin tabs exist while pinning only shell tabs and preserving user reordering for Gradebook, Calendar, Schedule, Todo, and custom tabs. |
| usePluginSharedSettings.ts | Hook module | Loads one plugin-level shared-settings record from shared Query cache for the active semester/course context and syncs updates through framework autosave with debounce and max-wait forcing. |
| usePrefersReducedMotion.ts | Hook module | Custom hook implementing use prefers reduced motion behavior. |
| useScrollProgress.ts | Hook module | Custom hook implementing use scroll progress behavior. |
| useSemesterTodoQuery.ts | Hook module | Shared TanStack Query hook pair for semester todo reads plus cache lookups/writes reused by Todo and Calendar-adjacent flows. |
| useStickyCollapse.ts | Hook module | Custom hook implementing use sticky collapse behavior. |
| useTouchDevice.ts | Hook module | Custom hook implementing use touch device behavior. |
| useVisibleTabSettingsPreload.ts | Hook module | Preloads visible tab runtimes so inactive tabs can still expose instance settings inside the Settings page. |
