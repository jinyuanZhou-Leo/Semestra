"use no memo";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { CalendarSettingsState } from '../../shared/types';
import { normalizeDayMinuteWindow, parseTimeInputValue, toTimeInputValue } from './settings';

interface CalendarSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: CalendarSettingsState;
  onChange: (nextSettings: CalendarSettingsState) => void;
  onReset: () => void;
}

export const CalendarSettings: React.FC<CalendarSettingsProps> = ({
  open,
  onOpenChange,
  settings,
  onChange,
  onReset,
}) => {
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

  const updateDayStartTime = (value: string) => {
    const parsed = parseTimeInputValue(value);
    if (parsed === null) return;
    const minuteWindow = normalizeDayMinuteWindow(parsed, settings.dayEndMinutes);
    patchSettings({
      dayStartMinutes: minuteWindow.dayStartMinutes,
      dayEndMinutes: minuteWindow.dayEndMinutes,
    });
  };

  const updateDayEndTime = (value: string) => {
    const parsed = parseTimeInputValue(value);
    if (parsed === null) return;
    const minuteWindow = normalizeDayMinuteWindow(settings.dayStartMinutes, parsed);
    patchSettings({
      dayStartMinutes: minuteWindow.dayStartMinutes,
      dayEndMinutes: minuteWindow.dayEndMinutes,
    });
  };

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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="calendar-day-start">Day start time</Label>
              <Input
                id="calendar-day-start"
                type="time"
                step={1800}
                value={toTimeInputValue(settings.dayStartMinutes)}
                onChange={(event) => updateDayStartTime(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar-day-end">Day end time</Label>
              <Input
                id="calendar-day-end"
                type="time"
                step={1800}
                value={toTimeInputValue(settings.dayEndMinutes)}
                onChange={(event) => updateDayEndTime(event.target.value)}
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

          <div className="space-y-3">
            <p className="text-sm font-medium">Event colors</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="color-schedule">Schedule</Label>
                <Input
                  id="color-schedule"
                  type="color"
                  value={settings.eventColors.schedule}
                  onChange={(event) => patchSettings({ eventColors: { ...settings.eventColors, schedule: event.target.value } })}
                  className="h-10 w-full cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="color-todo">Todo</Label>
                <Input
                  id="color-todo"
                  type="color"
                  value={settings.eventColors.todo}
                  onChange={(event) => patchSettings({ eventColors: { ...settings.eventColors, todo: event.target.value } })}
                  className="h-10 w-full cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="color-custom">Custom</Label>
                <Input
                  id="color-custom"
                  type="color"
                  value={settings.eventColors.custom}
                  onChange={(event) => patchSettings({ eventColors: { ...settings.eventColors, custom: event.target.value } })}
                  className="h-10 w-full cursor-pointer"
                />
              </div>
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
