// input:  [calendar-core source registrations, consumers, and React integration points]
// output: [public calendar-core registry helpers and shared type exports]
// pos:    [single import surface for standalone Calendar extension APIs]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export type {
  CalendarEventData,
  CalendarEventPatch,
  CalendarRefreshSignal,
  CalendarSourceContext,
  CalendarSourceDefinition,
  SemesterDateRange,
} from './types';
export {
  getRegisteredCalendarSources,
  registerCalendarSources,
  subscribeCalendarSourceRegistry,
  useCalendarSourceRegistry,
} from './registry';
