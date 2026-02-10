import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ALL_FILTER_VALUE } from '../../shared/constants';
import type { CalendarSettingsState } from '../../shared/types';

interface CalendarSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: CalendarSettingsState;
  courseOptions: Array<{ id: string; name: string }>;
  typeOptions: string[];
  onChange: (nextSettings: CalendarSettingsState) => void;
  onReset: () => void;
}

export const CalendarSettings: React.FC<CalendarSettingsProps> = ({
  open,
  onOpenChange,
  settings,
  courseOptions,
  typeOptions,
  onChange,
  onReset,
}) => {
  const patchSettings = (patch: Partial<CalendarSettingsState>) => {
    onChange({
      ...settings,
      ...patch,
      filters: {
        ...settings.filters,
        ...(patch.filters ?? {}),
      },
      eventColors: {
        ...settings.eventColors,
        ...(patch.eventColors ?? {}),
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Calendar Settings</DialogTitle>
          <DialogDescription>
            Configure visibility, filters, and event colors for the calendar view.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="calendar-skipped-display">Skipped events</Label>
            <Select
              value={settings.skippedDisplay}
              onValueChange={(value) => patchSettings({ skippedDisplay: value as CalendarSettingsState['skippedDisplay'] })}
            >
              <SelectTrigger id="calendar-skipped-display" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grayed">Show as grayed</SelectItem>
                <SelectItem value="hidden">Hide skipped</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="calendar-course-filter">Course filter</Label>
              <Select
                value={settings.filters.courseFilter}
                onValueChange={(value) => patchSettings({ filters: { ...settings.filters, courseFilter: value } })}
              >
                <SelectTrigger id="calendar-course-filter" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>All courses</SelectItem>
                  {courseOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar-type-filter">Type filter</Label>
              <Select
                value={settings.filters.typeFilter}
                onValueChange={(value) => patchSettings({ filters: { ...settings.filters, typeFilter: value } })}
              >
                <SelectTrigger id="calendar-type-filter" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>All types</SelectItem>
                  {typeOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="calendar-conflict-only" className="cursor-pointer">Conflict only</Label>
              <p className="text-xs text-muted-foreground">Show only events in conflict groups.</p>
            </div>
            <Switch
              id="calendar-conflict-only"
              checked={settings.filters.showConflictsOnly}
              onCheckedChange={(checked) => patchSettings({ filters: { ...settings.filters, showConflictsOnly: checked } })}
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
