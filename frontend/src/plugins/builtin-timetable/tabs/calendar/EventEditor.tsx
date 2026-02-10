import React from 'react';
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
  onSave: (eventId: string, patch: CalendarEventPatch) => Promise<void>;
}

export const EventEditor: React.FC<EventEditorProps> = ({ open, onOpenChange, event, onSave }) => {
  const [isSkipped, setIsSkipped] = React.useState(false);
  const [isEnabled, setIsEnabled] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!event || !open) return;
    setIsSkipped(event.isSkipped);
    setIsEnabled(event.enable);
  }, [event, open]);

  const handleSave = async () => {
    if (!event) return;

    setIsSaving(true);
    try {
      await onSave(event.eventId, {
        skip: isSkipped,
        enable: isEnabled,
      });
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
            Update visibility and active state for this event.
          </DialogDescription>
        </DialogHeader>

        {!event ? null : (
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <p className="font-medium">{event.title}</p>
              <p className="text-sm text-muted-foreground">
                {event.courseName} · {event.eventTypeCode}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Week {event.week}, {event.start.toLocaleDateString()} {event.startTime}-{event.endTime}
              </p>
            </div>

            <div className="space-y-3">
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
