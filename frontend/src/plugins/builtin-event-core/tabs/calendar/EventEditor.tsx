// input:  [selected calendar event, optional conflict peers, dialog state, week-label formatter, and save callback]
// output: [`EventEditor` modal for event visibility/enable toggles plus conflict context]
// pos:    [Calendar detail dialog that explains schedule conflicts while editing an event with Reading Week-aware labels]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { CalendarEventData, CalendarEventPatch } from '../../shared/types';

interface EventEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEventData | null;
  conflictingEvents?: CalendarEventData[];
  formatWeekLabel?: (week: number) => string;
  onSave: (eventId: string, patch: CalendarEventPatch) => Promise<void>;
}

export const EventEditor: React.FC<EventEditorProps> = ({
  open,
  onOpenChange,
  event,
  conflictingEvents = [],
  formatWeekLabel,
  onSave,
}) => {
  const [isSkipped, setIsSkipped] = React.useState(false);
  const [isEnabled, setIsEnabled] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const showEnableSwitch = event?.source !== 'schedule';
  const conflictingPeers = React.useMemo(() => {
    if (!event?.conflictGroupId) return [];
    return conflictingEvents.filter((item) => item.id !== event.id);
  }, [conflictingEvents, event?.conflictGroupId, event?.id]);

  React.useEffect(() => {
    if (!event || !open) return;
    setIsSkipped(event.isSkipped);
    setIsEnabled(event.enable);
  }, [event, open]);

  const handleSave = async () => {
    if (!event) return;

    setIsSaving(true);
    try {
      const patch: CalendarEventPatch = {
        skip: isSkipped,
      };
      if (showEnableSwitch) {
        patch.enable = isEnabled;
      }

      await onSave(event.eventId, patch);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Event Details
            <Badge variant="secondary">{event?.source ?? 'schedule'}</Badge>
          </DialogTitle>
          <DialogDescription>
            {showEnableSwitch ? 'Update visibility and active state for this event.' : 'Update visibility for this event.'}
          </DialogDescription>
        </DialogHeader>

        {!event ? null : (
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <p className="font-medium">{event.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatWeekLabel ? formatWeekLabel(event.week) : `Week ${event.week}`}, {event.start.toLocaleDateString()} {event.startTime}-{event.endTime}
              </p>
            </div>

            {event.isConflict ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/8 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Conflict detected
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  This event overlaps with {conflictingPeers.length === 0 ? 'another scheduled event' : `${conflictingPeers.length} other event${conflictingPeers.length === 1 ? '' : 's'}`}.
                </p>
                {conflictingPeers.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {conflictingPeers.map((item) => (
                      <div key={item.id} className="rounded border border-destructive/20 bg-background/70 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{item.courseName}</p>
                          <Badge variant="outline" className="shrink-0 border-destructive/30 text-destructive">
                            {item.eventTypeCode}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatWeekLabel ? formatWeekLabel(item.week) : `Week ${item.week}`} · {item.start.toLocaleDateString()} · {item.startTime}-{item.endTime}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3">
              {showEnableSwitch ? (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="event-editor-enable" className="cursor-pointer">Enabled</Label>
                    <p className="text-xs text-muted-foreground">Disabled events are not active for attendance flow.</p>
                  </div>
                  <Switch
                    id="event-editor-enable"
                    checked={isEnabled}
                    onCheckedChange={setIsEnabled}
                  />
                </div>
              ) : null}

              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="event-editor-skip" className="cursor-pointer">Skip this event</Label>
                  <p className="text-xs text-muted-foreground">Skipped events can be grayed or hidden in calendar settings.</p>
                </div>
                <Switch
                  id="event-editor-skip"
                  checked={isSkipped}
                  onCheckedChange={setIsSkipped}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
