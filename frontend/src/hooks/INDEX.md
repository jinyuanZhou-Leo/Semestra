<!-- ⚠️ Once this folder changes, update me. -->

Cross-page hooks for data sync, dashboard state, and UI responsiveness.
Contains optimistic CRUD orchestration for tabs/widgets with context-change cancellation guards.
Includes stale-request-safe fetch primitives plus parallelized order/layout backend synchronization logic.

| File | Role | Description |
|------|------|-------------|
| __tests__/ | Subdirectory | Test cases for modules in this folder. |
| use-mobile.ts | Hook module | Mobile breakpoint hook (640px) with immediate client-side width initialization to avoid first-frame responsive surface mismatches. |
| useAppStatus.ts | Hook module | Custom hook implementing use app status behavior. |
| useDashboardTabs.ts | Hook module | Orchestrates tab CRUD with optimistic state, debounced settings sync, context-key reset safeguards, and parallelized order persistence retries. |
| useDashboardWidgets.ts | Hook module | Orchestrates widget CRUD, resilient settings/layout parsing, context-key reset safeguards, and split local layout sync with parallelized commit persistence. |
| useDataFetch.ts | Hook module | Generic fetch hook with loading/error state plus stale-response guards to prevent older requests from overwriting newer state. |
| useEntityContext.ts | Hook module | Generic optimistic entity-sync hook with debounced persistence and entity-switch guards for pending update queues. |
| useHomepageBuiltinTabs.ts | Hook module | Custom hook implementing use homepage builtin tabs behavior. |
| usePrefersReducedMotion.ts | Hook module | Custom hook implementing use prefers reduced motion behavior. |
| useScrollProgress.ts | Hook module | Custom hook implementing use scroll progress behavior. |
| useStickyCollapse.ts | Hook module | Custom hook implementing use sticky collapse behavior. |
| useTouchDevice.ts | Hook module | Custom hook implementing use touch device behavior. |
