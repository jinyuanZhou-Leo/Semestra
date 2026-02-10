# Builtin Timetable Refactor TODO List

## Ground Rules

- [ ] Use `shadcn/ui` + Tailwind CSS v4 for all new UI.
- [ ] Keep all timetable-related component implementations under `frontend/src/plugins/builtin-timetable/**`.
- [ ] Do not place new timetable components in `frontend/src/components/**`.
- [ ] Keep code comments in English.

## Phase 0 - Plugin Runtime (First Step)

- [x] Replace eager plugin registration with on-demand runtime loading.
  - Implemented `frontend/src/plugins/runtime/index.ts`.
  - Added type-based lazy loaders:
    - `ensureTabPluginByTypeLoaded`
    - `ensureWidgetPluginByTypeLoaded`
    - `ensureBuiltinTabPluginsLoaded`
- [x] Remove startup full plugin loading from `frontend/src/main.tsx`.
- [x] Make add flows lazy-load plugin before add/create API call:
  - `frontend/src/components/AddTabModal.tsx`
  - `frontend/src/components/AddWidgetModal.tsx`
  - `frontend/src/hooks/useDashboardTabs.ts`
  - `frontend/src/hooks/useDashboardWidgets.ts`
- [x] Add plugin load skeletons to reduce visual flicker:
  - `frontend/src/plugins/runtime/PluginLoadSkeleton.tsx`
  - Integrated in tab/widget render paths.

## Phase 1 - Builtin Timetable Structure Refactor

- [ ] Reorganize timetable plugin into target structure:
  - `frontend/src/plugins/builtin-timetable/shared/*`
  - `frontend/src/plugins/builtin-timetable/shared/hooks/*`
  - `frontend/src/plugins/builtin-timetable/tabs/calendar/*`
  - `frontend/src/plugins/builtin-timetable/tabs/semester-schedule/*`
  - `frontend/src/plugins/builtin-timetable/tabs/course-schedule/*`
  - `frontend/src/plugins/builtin-timetable/tabs/todo/*`
- [ ] Keep compatibility exports in `frontend/src/plugins/builtin-timetable/index.ts`.
- [ ] Add migration notes for old import paths inside plugin folder.

## Phase 2 - Data Layer and Performance Core

- [ ] Implement `useScheduleData` (parallel week loading + cache strategy) in:
  - `frontend/src/plugins/builtin-timetable/shared/hooks/useScheduleData.ts`
- [ ] Add optimized event bus with dedupe/debounce in:
  - `frontend/src/plugins/builtin-timetable/shared/eventBus.ts`
- [ ] Add shared constants/types/utils:
  - `frontend/src/plugins/builtin-timetable/shared/constants.ts`
  - `frontend/src/plugins/builtin-timetable/shared/types.ts`
  - `frontend/src/plugins/builtin-timetable/shared/utils.ts`
- [ ] Ensure expensive transforms are memoized and reusable.
- [ ] Add cancellation guards for async effects to avoid stale updates.

## Phase 3 - Calendar Tab (Dynamic + Suspense)

- [ ] Create lazy calendar tab entry:
  - `frontend/src/plugins/builtin-timetable/tabs/calendar/index.ts`
- [ ] Build calendar container with `Suspense` boundaries:
  - `frontend/src/plugins/builtin-timetable/tabs/calendar/CalendarTab.tsx`
- [ ] Split FullCalendar into dynamic chunk:
  - `frontend/src/plugins/builtin-timetable/tabs/calendar/FullCalendarView.tsx`
- [ ] Build calendar toolbar/settings/editor:
  - `CalendarToolbar.tsx`
  - `CalendarSettings.tsx`
  - `EventEditor.tsx`
- [ ] Add calendar skeletons in plugin directory:
  - `tabs/calendar/components/CalendarSkeleton.tsx`
- [ ] Ensure no UI flicker while switching/initializing tab content.

## Phase 4 - Semester/Course Schedule Tabs

- [ ] Implement semester schedule tab:
  - `tabs/semester-schedule/SemesterScheduleTab.tsx`
  - `tabs/semester-schedule/SemesterScheduleSettings.tsx`
- [ ] Implement course schedule tab:
  - `tabs/course-schedule/CourseScheduleTab.tsx`
  - `tabs/course-schedule/CourseScheduleSettings.tsx`
- [ ] Implement virtualized schedule list:
  - `tabs/semester-schedule/components/VirtualizedScheduleList.tsx`
- [ ] Add schedule skeletons in plugin folder:
  - `tabs/semester-schedule/components/ScheduleSkeleton.tsx`

## Phase 5 - UX Enhancements from Plan

- [ ] Implement Skip quick action (table inline, touch-friendly 44x44).
- [ ] Improve calendar event editor with clearer skip state and source badge.
- [ ] Add color picker enhancements with accessible presets.
- [ ] Add pending/transition feedback (`useTransition`) for heavy UI updates.
- [ ] Ensure reduced motion support (`motion-reduce`) for transitions.

## Phase 6 - Settings and Plugin Integration

- [ ] Wire tab settings components through registry definitions.
- [ ] Keep plugin-level settings discoverable in Settings tab.
- [ ] Ensure timetable legacy alias (`schedule`) remains backward-compatible.
- [ ] Keep dashboard/settings/timetable builtin behavior unchanged for users.

## Phase 7 - Quality and Acceptance

- [ ] Add/extend tests for:
  - lazy plugin load behavior
  - tab/widget add flow after lazy load
  - fallback skeleton rendering
  - timetable data transform correctness
- [ ] Validate acceptance checklist from `docs/timetable_refactoring_plan_optimized.md`:
  - performance
  - accessibility
  - touch usability
  - functional parity
  - technical quality
- [ ] Run frontend checks:
  - `npm --prefix frontend run build`
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run lint` (existing repo lint debt should be tracked separately)

## Suggested Execution Order

- [ ] Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6 -> Phase 7
- [ ] Keep each phase in a separate PR-sized commit group to reduce regression risk.
