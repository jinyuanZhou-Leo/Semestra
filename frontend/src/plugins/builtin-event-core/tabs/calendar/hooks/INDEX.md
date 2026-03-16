<!-- ⚠️ Once this folder changes, update me. -->

`hooks/` isolates Calendar runtime orchestration into focused state modules.
These hooks split semester context, navigation, source loading, and editing into low-coupling units with Query-cache-aware reload behavior and cache-first event preservation.
`CalendarTab` composes them into the final Calendar shell.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for Calendar orchestration hooks. |
| useCalendarEventEditing.ts | Edit-flow hook | Manages source-aware detail-vs-edit dialog behavior, optimistic skip patches, and editor state. |
| useCalendarNavigationState.ts | Navigation hook | Owns week/month state, DST-safe academic week labels, buffered query windows, adjacent-window prefetch ranges, and user-navigation rules independent from source loading and week-view layout. |
| useCalendarSources.ts | Source orchestration hook | Hydrates registered Calendar sources from cache first, revalidates sources when they are re-enabled, lets sources invalidate their own caches, progressively commits each source as it resolves, and supports targeted refreshes without full cold reloads or remount skeleton flashes. |
| useSemesterCalendarContext.ts | Semester context hook | Resolves stable semester date bounds and DST-safe max-week values from the shared semester Query cache with explicit invalidation-driven refreshes. |
| useViewportBoundHeight.ts | Layout hook | Measures the available Calendar shell height from a stable layout dependency key without coupling resize observers to business state. |
