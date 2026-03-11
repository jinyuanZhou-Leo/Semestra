<!-- ⚠️ Once this folder changes, update me. -->

`hooks/` isolates Calendar runtime orchestration into focused state modules.
These hooks split semester context, navigation, source loading, and editing into low-coupling units.
`CalendarTab` composes them into the final Calendar shell.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for Calendar orchestration hooks. |
| useCalendarEventEditing.ts | Edit-flow hook | Manages source-aware editability, optimistic skip patches, and editor state. |
| useCalendarNavigationState.ts | Navigation hook | Owns week/month state, DST-safe academic week labels, and user-navigation rules independent from source loading and week-view layout. |
| useCalendarSources.ts | Source orchestration hook | Loads registered Calendar sources independently from the current semester context and supports targeted refreshes. |
| useSemesterCalendarContext.ts | Semester context hook | Resolves stable semester date bounds and DST-safe max-week values outside of source loaders. |
| useViewportBoundHeight.ts | Layout hook | Measures the available Calendar shell height from a stable layout dependency key without coupling resize observers to business state. |
