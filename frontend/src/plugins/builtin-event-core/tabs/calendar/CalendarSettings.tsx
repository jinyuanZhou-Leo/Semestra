// input:  [dialog open state, calendar settings state, and settings mutation callbacks]
// output: [`CalendarSettings` legacy dialog UI for time window, week-number toggles, and colors]
// pos:    [legacy calendar settings surface kept for direct in-tab configuration flows]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCalendarSourceRegistry } from '@/calendar-core';
import type { CalendarSettingsState } from '../../shared/types';
import {
  CALENDAR_TIME_INPUT_STEP_SECONDS,
  normalizeDayMinuteWindow,
  parseTimeInputValue,
  toTimeInputValue,
} from './settings';

interface CalendarSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: CalendarSettingsState;
  onChange: (nextSettings: CalendarSettingsState) => void;
  onReset: () => void;
}

const WEEK_VIEW_DAY_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

export const CalendarSettings: React.FC<CalendarSettingsProps> = ({
  open,
  onOpenChange,
  settings,
  onChange,
  onReset,
}) => {
  const calendarSources = useCalendarSourceRegistry();
  const [dayStartDraft, setDayStartDraft] = React.useState(() => toTimeInputValue(settings.dayStartMinutes));
  const [dayEndDraft, setDayEndDraft] = React.useState(() => toTimeInputValue(settings.dayEndMinutes));

  const patchSettings = (patch: Partial<CalendarSettingsState>) => {
    onChange({
      ...settings,
      ...patch,
      eventColors: {
        ...settings.eventColors,
        ...(patch.eventColors ?? {}),
      },
    });
  };

  React.useEffect(() => {
    setDayStartDraft(toTimeInputValue(settings.dayStartMinutes));
  }, [settings.dayStartMinutes]);

  React.useEffect(() => {
    setDayEndDraft(toTimeInputValue(settings.dayEndMinutes));
  }, [settings.dayEndMinutes]);

  const commitDayStartTime = React.useCallback((value: string) => {
    const parsed = parseTimeInputValue(value);
    if (parsed === null) {
      setDayStartDraft(toTimeInputValue(settings.dayStartMinutes));
      return;
    }
    const minuteWindow = normalizeDayMinuteWindow(parsed, settings.dayEndMinutes);
    patchSettings({
      dayStartMinutes: minuteWindow.dayStartMinutes,
      dayEndMinutes: minuteWindow.dayEndMinutes,
    });
  }, [settings.dayEndMinutes, settings.dayStartMinutes]);

  const commitDayEndTime = React.useCallback((value: string) => {
    const parsed = parseTimeInputValue(value);
    if (parsed === null) {
      setDayEndDraft(toTimeInputValue(settings.dayEndMinutes));
      return;
    }
    const minuteWindow = normalizeDayMinuteWindow(settings.dayStartMinutes, parsed);
    patchSettings({
      dayStartMinutes: minuteWindow.dayStartMinutes,
      dayEndMinutes: minuteWindow.dayEndMinutes,
    });
  }, [settings.dayEndMinutes, settings.dayStartMinutes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Calendar Settings</DialogTitle>
          <DialogDescription>
            Configure visibility and event colors for the calendar view.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="space-y-2">
              <Label htmlFor="calendar-week-view-day-count">Days per screen</Label>
              <Select
                value={String(settings.weekViewDayCount)}
                onValueChange={(value) => patchSettings({ weekViewDayCount: Number(value) })}
              >
                <SelectTrigger id="calendar-week-view-day-count" className="w-full">
                  <SelectValue placeholder="Select visible days" />
                </SelectTrigger>
                <SelectContent>
                  {WEEK_VIEW_DAY_COUNT_OPTIONS.map((dayCount) => (
                    <SelectItem key={dayCount} value={String(dayCount)}>
                      {dayCount} day{dayCount === 1 ? '' : 's'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="calendar-day-start">Day start time</Label>
              <Input
                id="calendar-day-start"
                type="time"
                step={CALENDAR_TIME_INPUT_STEP_SECONDS}
                value={dayStartDraft}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDayStartDraft(nextValue);
                  if (parseTimeInputValue(nextValue) !== null) {
                    commitDayStartTime(nextValue);
                  }
                }}
                onBlur={(event) => commitDayStartTime(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  commitDayStartTime(event.currentTarget.value);
                  event.currentTarget.blur();
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar-day-end">Day end time</Label>
              <Input
                id="calendar-day-end"
                type="time"
                step={CALENDAR_TIME_INPUT_STEP_SECONDS}
                value={dayEndDraft}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDayEndDraft(nextValue);
                  if (parseTimeInputValue(nextValue) !== null) {
                    commitDayEndTime(nextValue);
                  }
                }}
                onBlur={(event) => commitDayEndTime(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  commitDayEndTime(event.currentTarget.value);
                  event.currentTarget.blur();
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="calendar-highlight-conflicts" className="cursor-pointer">Highlight conflicts</Label>
              <p className="text-xs text-muted-foreground">Use stronger visual emphasis for conflict events.</p>
            </div>
            <Switch
              id="calendar-highlight-conflicts"
              checked={settings.highlightConflicts}
              onCheckedChange={(checked) => patchSettings({ highlightConflicts: checked })}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="calendar-show-weekends" className="cursor-pointer">Show weekends</Label>
              <p className="text-xs text-muted-foreground">Display Saturday and Sunday columns in calendar views.</p>
            </div>
            <Switch
              id="calendar-show-weekends"
              checked={settings.showWeekends}
              onCheckedChange={(checked) => patchSettings({ showWeekends: checked })}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="calendar-count-reading-week" className="cursor-pointer">Count Reading Week in week number</Label>
              <p className="text-xs text-muted-foreground">When disabled, weeks after Reading Week keep academic numbering without counting the break week.</p>
            </div>
            <Switch
              id="calendar-count-reading-week"
              checked={settings.countReadingWeekInWeekNumber}
              onCheckedChange={(checked) => patchSettings({ countReadingWeekInWeekNumber: checked })}
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Event colors</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {calendarSources.map((source) => (
                <div key={source.id} className="space-y-1.5">
                  <Label htmlFor={`color-${source.id}`}>{source.label}</Label>
                  <Input
                    id={`color-${source.id}`}
                    type="color"
                    value={settings.eventColors[source.id] ?? source.defaultColor}
                    onChange={(event) => patchSettings({ eventColors: { ...settings.eventColors, [source.id]: event.target.value } })}
                    className="h-10 w-full cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onReset}>Reset</Button>
            <Button type="button" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
