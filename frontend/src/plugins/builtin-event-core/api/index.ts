// input:  [calendar API surface]
// output: [public API barrel for builtin-event-core consumers]
// pos:    [single import surface for external plugins consuming builtin-event-core APIs]

export {
  registerCalendarSource,
  useCalendarSourceRegistry,
  type ExternalCalendarSourceDefinition,
  type CalendarEventBase,
  type CalendarEventPatch,
  type CalendarRefreshSignal,
  type CalendarScopeRange,
  type CalendarSourceContext,
  type CalendarSourceDefinition,
} from './calendar';
