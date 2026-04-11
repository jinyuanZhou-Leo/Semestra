// input:  [calendar-core registry, generic source definition, and base event types]
// output: [public calendar API for external plugins to register calendar sources and consume calendar state]
// pos:    [public API surface that allows other plugins to extend the built-in calendar with custom event sources]

import type { CalendarEventBase, CalendarSourceDefinition } from '../calendar-core';
import { registerCalendarSources, useCalendarSourceRegistry } from '../calendar-core';

/**
 * A calendar source definition for external consumers.
 * Unlike CalendarSourceDefinition, ownerId is omitted — it is set automatically
 * from the pluginId passed to registerCalendarSource.
 */
export type ExternalCalendarSourceDefinition<TEvent extends CalendarEventBase = CalendarEventBase> =
  Omit<CalendarSourceDefinition<TEvent>, 'ownerId'>;

/**
 * Register a calendar source from an external plugin.
 * Returns a cleanup function to deregister the source.
 *
 * @param pluginId - Unique identifier for your plugin (used as ownerId)
 * @param source - Source definition without ownerId
 */
export const registerCalendarSource = (
  pluginId: string,
  source: ExternalCalendarSourceDefinition,
): (() => void) => {
  const fullSource: CalendarSourceDefinition = { ...source, ownerId: pluginId };
  return registerCalendarSources(pluginId, [fullSource]);
};

export { useCalendarSourceRegistry };

export type {
  CalendarEventBase,
  CalendarEventPatch,
  CalendarRefreshSignal,
  CalendarScopeRange,
  CalendarSourceContext,
  CalendarSourceDefinition,
} from '../calendar-core';
