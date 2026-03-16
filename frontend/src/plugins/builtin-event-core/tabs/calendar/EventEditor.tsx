// input:  [selected calendar event, optional conflict peers, dialog state, week-label formatter, source label, LMS HTML safety setting, and save callback]
// output: [`EventEditor` modal for source-aware event details plus optional skip editing and conflict context]
// pos:    [Calendar detail dialog that explains schedule conflicts while optionally editing occurrence skip state with Reading Week-aware labels and source-aware description sanitization]
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
import { looksLikeHtml, sanitizeHtmlFragment, sanitizeTextListHtmlFragment } from '@/lib/html';
import type { CalendarEventData, CalendarEventPatch } from '@/calendar-core';
import { BUILTIN_CALENDAR_SOURCE_LMS } from '../../shared/constants';

interface EventEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEventData | null;
  sourceLabel: string;
  canEdit: boolean;
  renderUnsafeLmsDescriptionHtml: boolean;
  conflictingEvents?: CalendarEventData[];
  formatWeekLabel?: (week: number) => string;
  onSave: (eventId: string, patch: CalendarEventPatch) => Promise<void>;
}

export const EventEditor: React.FC<EventEditorProps> = ({
  open,
  onOpenChange,
  event,
  sourceLabel,
  canEdit,
  renderUnsafeLmsDescriptionHtml,
  conflictingEvents = [],
  formatWeekLabel,
  onSave,
}) => {
  const [isSkipped, setIsSkipped] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const sanitizedDescription = React.useMemo(() => {
    if (!looksLikeHtml(event?.note)) return '';
    if (event?.sourceId !== BUILTIN_CALENDAR_SOURCE_LMS) {
      return sanitizeHtmlFragment(event?.note);
    }
    return renderUnsafeLmsDescriptionHtml
      ? sanitizeHtmlFragment(event?.note)
      : sanitizeTextListHtmlFragment(event?.note);
  }, [event?.note, event?.sourceId, renderUnsafeLmsDescriptionHtml]);
  const conflictingPeers = React.useMemo(() => {
    if (!event?.conflictGroupId) return [];
    return conflictingEvents.filter((item) => item.id !== event.id);
  }, [conflictingEvents, event?.conflictGroupId, event?.id]);

  React.useEffect(() => {
    if (!event || !open) return;
    setIsSkipped(event.isSkipped);
  }, [event, open]);

  const handleSave = async () => {
    if (!event) return;

    setIsSaving(true);
    try {
      await onSave(event.eventId, { skip: isSkipped });
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
            <Badge variant="secondary">{sourceLabel}</Badge>
          </DialogTitle>
          <DialogDescription>
            {canEdit ? 'Review details and update visibility for this event.' : 'Review details for this read-only event.'}
          </DialogDescription>
        </DialogHeader>

        {!event ? null : (
          <div className="space-y-4">
            <div>
              <p className="font-medium">{event.title}</p>
              {event.subtitle ? (
                <p className="mt-1 text-sm text-muted-foreground">{event.subtitle}</p>
              ) : null}
              <p className="mt-1 text-sm text-muted-foreground">
                {formatWeekLabel ? formatWeekLabel(event.week) : `Week ${event.week}`}, {event.start.toLocaleDateString()} {event.startTime}-{event.endTime}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {event.courseName}
              </p>
              {event.note ? (
                <div
                  className="mt-3 h-48 overflow-y-auto rounded border bg-muted/30 px-3 py-2 text-sm text-foreground/90 [&_a]:text-primary [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-background/80 [&_code]:px-1 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-medium [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:rounded [&_pre]:bg-background/80 [&_pre]:p-2 [&_ul]:list-disc [&_ul]:pl-5]"
                  dangerouslySetInnerHTML={sanitizedDescription ? { __html: sanitizedDescription } : undefined}
                >
                  {sanitizedDescription ? null : event.note}
                </div>
              ) : null}
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

            {canEdit ? (
              <div className="space-y-3">
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
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant={canEdit ? 'outline' : 'default'} onClick={() => onOpenChange(false)} disabled={isSaving}>
                {canEdit ? 'Cancel' : 'Close'}
              </Button>
              {canEdit ? (
                <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
