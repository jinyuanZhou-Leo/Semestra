// input:  [calendar events, source definitions, source context, and save-success side effects]
// output: [`useCalendarEventEditing()` hook exposing editor state, optimistic patches, and save handlers]
// pos:    [calendar edit-flow hook that keeps source-aware editability and optimistic skip updates out of CalendarTab]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { toast } from 'sonner';
import type {
  CalendarEventData,
  CalendarEventPatch,
  CalendarSourceContext,
  CalendarSourceDefinition,
} from '@/calendar-core';

interface UseCalendarEventEditingOptions {
  events: CalendarEventData[];
  sources: CalendarSourceDefinition[];
  context: CalendarSourceContext | null;
  onSaveSuccess: (event: CalendarEventData) => Promise<void>;
}

export const useCalendarEventEditing = ({
  events,
  sources,
  context,
  onSaveSuccess,
}: UseCalendarEventEditingOptions) => {
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEventData | null>(null);
  const [selectedSourceLabel, setSelectedSourceLabel] = React.useState('Schedule');
  const [isEventEditorOpen, setIsEventEditorOpen] = React.useState(false);
  const [optimisticPatches, setOptimisticPatches] = React.useState<Map<string, CalendarEventPatch>>(new Map());

  const sourceById = React.useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );
  const eventsById = React.useMemo(() => {
    const map = new Map<string, CalendarEventData>();
    for (const event of events) {
      if (!map.has(event.eventId)) {
        map.set(event.eventId, event);
      }
    }
    return map;
  }, [events]);

  const eventsWithOptimisticPatches = React.useMemo(() => {
    if (optimisticPatches.size === 0) return events;

    return events.map((event) => {
      const patch = optimisticPatches.get(event.eventId);
      if (!patch) return event;
      return {
        ...event,
        isSkipped: typeof patch.skip === 'boolean' ? patch.skip : event.isSkipped,
        enable: typeof patch.enable === 'boolean' ? patch.enable : event.enable,
      };
    });
  }, [events, optimisticPatches]);

  const handleEventClick = React.useCallback((event: CalendarEventData) => {
    const source = sourceById.get(event.sourceId);
    if (!source?.applyEventPatch) {
      toast.message(`${source?.label ?? 'This source'} items are read-only in calendar.`);
      return;
    }

    setSelectedEvent(event);
    setSelectedSourceLabel(source.label);
    setIsEventEditorOpen(true);
  }, [sourceById]);

  const handleSaveEvent = React.useCallback(async (eventId: string, patch: CalendarEventPatch) => {
    if (!context) {
      toast.error('Semester context is required to update events.');
      return;
    }

    const targetEvent = eventsById.get(eventId);
    if (!targetEvent) {
      toast.error('Unable to locate event for update.');
      return;
    }

    const source = sourceById.get(targetEvent.sourceId);
    if (!source?.applyEventPatch) {
      toast.error('This calendar source does not support editing.');
      return;
    }

    setOptimisticPatches((current) => {
      const next = new Map(current);
      next.set(eventId, {
        ...next.get(eventId),
        ...patch,
      });
      return next;
    });

    try {
      await source.applyEventPatch(targetEvent, patch, context);
      await onSaveSuccess(targetEvent);
      setOptimisticPatches((current) => {
        const next = new Map(current);
        next.delete(eventId);
        return next;
      });
    } catch (error: any) {
      setOptimisticPatches((current) => {
        const next = new Map(current);
        next.delete(eventId);
        return next;
      });
      toast.error(error?.response?.data?.detail?.message ?? error?.message ?? 'Failed to update event.');
      throw error;
    }
  }, [context, eventsById, onSaveSuccess, sourceById]);

  return {
    selectedEvent,
    selectedSourceLabel,
    isEventEditorOpen,
    setIsEventEditorOpen,
    eventsWithOptimisticPatches,
    handleEventClick,
    handleSaveEvent,
  };
};
