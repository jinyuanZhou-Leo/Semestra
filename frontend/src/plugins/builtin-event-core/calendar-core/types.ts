// input:  [React-facing calendar consumers, source loaders, generic event base types, and event refresh signals]
// output: [shared calendar-core event/source/context type contracts with generic source definitions]
// pos:    [standalone calendar domain contract layer used by Calendar UI and external source registrations, including scope-based context, generic event types, and signal-based refresh coordination]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export interface CalendarQueryRange {
  start: Date;
  end: Date;
}

export interface CalendarScopeRange {
  startDate: Date;
  endDate: Date;
}

export interface CalendarEventBase {
  id: string;
  sourceId: string;
  title: string;
  subtitle?: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  color?: string;
  note?: string | null;
}

export interface CalendarEventPatch {
  skip?: boolean;
  enable?: boolean;
}

export interface CalendarSourceContext {
  scopeId: string;
  scopeRange: CalendarScopeRange;
  maxPeriod: number;
  queryRange: CalendarQueryRange;
  prefetchQueryRanges?: CalendarQueryRange[];
}

export type CalendarRefreshSignal =
  | { type: 'manual'; signalId?: string }
  | { type: 'full'; scopeId?: string; signalId?: string }
  | { type: 'partial'; scopeId: string; entityId?: string; tag?: string; signalId?: string };

export interface CalendarSourceDefinition<TEvent extends CalendarEventBase = CalendarEventBase> {
  id: string;
  ownerId: string;
  label: string;
  defaultColor: string;
  priority: number;
  getCached?: (context: CalendarSourceContext) => TEvent[] | undefined;
  load: (context: CalendarSourceContext) => Promise<TEvent[]>;
  invalidate?: (
    signal: CalendarRefreshSignal,
    context: CalendarSourceContext,
  ) => Promise<void> | void;
  shouldRefresh: (signal: CalendarRefreshSignal, context: CalendarSourceContext) => boolean;
  applyEventPatch?: (
    event: TEvent,
    patch: CalendarEventPatch,
    context: CalendarSourceContext,
  ) => Promise<void>;
}
