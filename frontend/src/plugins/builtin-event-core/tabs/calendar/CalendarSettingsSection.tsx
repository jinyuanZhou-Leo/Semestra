import React from 'react';
import { Button } from '@/components/ui/button';
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
import { ALL_FILTER_VALUE, CALENDAR_EVENT_DEFAULT_COLORS } from '../../shared/constants';
import { useScheduleData } from '../../shared/hooks/useScheduleData';
import type { CalendarSettingsState } from '../../shared/types';
import { buildCourseOptions, buildTypeOptions } from '../../shared/utils';

interface CalendarSettingsSectionProps {
  semesterId?: string;
  settings: any;
  updateSettings: (newSettings: any) => void | Promise<void>;
}

const DEFAULT_SETTINGS: CalendarSettingsState = {
  skippedDisplay: 'grayed',
  eventColors: {
    schedule: CALENDAR_EVENT_DEFAULT_COLORS.schedule,
    todo: CALENDAR_EVENT_DEFAULT_COLORS.todo,
    custom: CALENDAR_EVENT_DEFAULT_COLORS.custom,
  },
  filters: {
    courseFilter: ALL_FILTER_VALUE,
    typeFilter: ALL_FILTER_VALUE,
    showConflictsOnly: false,
  },
};

const normalizeCalendarSettings = (value: any): CalendarSettingsState => {
  const source = value && typeof value === 'object' ? value : {};
  const sourceFilters = source.filters && typeof source.filters === 'object' ? source.filters : {};
  const sourceColors = source.eventColors && typeof source.eventColors === 'object' ? source.eventColors : {};

  return {
    skippedDisplay: source.skippedDisplay === 'hidden' ? 'hidden' : 'grayed',
    eventColors: {
      schedule: typeof sourceColors.schedule === 'string' ? sourceColors.schedule : CALENDAR_EVENT_DEFAULT_COLORS.schedule,
      todo: typeof sourceColors.todo === 'string' ? sourceColors.todo : CALENDAR_EVENT_DEFAULT_COLORS.todo,
      custom: typeof sourceColors.custom === 'string' ? sourceColors.custom : CALENDAR_EVENT_DEFAULT_COLORS.custom,
    },
    filters: {
      courseFilter: typeof sourceFilters.courseFilter === 'string' ? sourceFilters.courseFilter : ALL_FILTER_VALUE,
      typeFilter: typeof sourceFilters.typeFilter === 'string' ? sourceFilters.typeFilter : ALL_FILTER_VALUE,
      showConflictsOnly: Boolean(sourceFilters.showConflictsOnly),
    },
  };
};

export const CalendarSettingsSection: React.FC<CalendarSettingsSectionProps> = ({ semesterId, settings, updateSettings }) => {
  const normalizedSettings = React.useMemo(() => normalizeCalendarSettings(settings), [settings]);
  const { items } = useScheduleData({
    semesterId,
    mode: 'all-weeks',
    enabled: Boolean(semesterId),
    withConflicts: true,
  });

  const courseOptions = React.useMemo(() => buildCourseOptions(items), [items]);
  const typeOptions = React.useMemo(() => buildTypeOptions(items), [items]);

  const patchSettings = (patch: Partial<CalendarSettingsState>) => {
    const nextSettings: CalendarSettingsState = {
      ...normalizedSettings,
      ...patch,
      filters: {
        ...normalizedSettings.filters,
        ...(patch.filters ?? {}),
      },
      eventColors: {
        ...normalizedSettings.eventColors,
        ...(patch.eventColors ?? {}),
      },
    };

    void Promise.resolve(updateSettings(nextSettings));
  };

  return (
    <div className="space-y-5 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor="calendar-settings-skipped-mode">Skipped events</Label>
        <Select
          value={normalizedSettings.skippedDisplay}
          onValueChange={(value) => patchSettings({ skippedDisplay: value as CalendarSettingsState['skippedDisplay'] })}
        >
          <SelectTrigger id="calendar-settings-skipped-mode" className="w-full">
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
          <Label htmlFor="calendar-settings-course-filter">Course filter</Label>
          <Select
            value={normalizedSettings.filters.courseFilter}
            onValueChange={(value) => patchSettings({ filters: { ...normalizedSettings.filters, courseFilter: value } })}
          >
            <SelectTrigger id="calendar-settings-course-filter" className="w-full">
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
          <Label htmlFor="calendar-settings-type-filter">Type filter</Label>
          <Select
            value={normalizedSettings.filters.typeFilter}
            onValueChange={(value) => patchSettings({ filters: { ...normalizedSettings.filters, typeFilter: value } })}
          >
            <SelectTrigger id="calendar-settings-type-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>All types</SelectItem>
              {typeOptions.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="calendar-settings-conflict" className="cursor-pointer">Conflict only</Label>
          <p className="text-xs text-muted-foreground">Show only events in conflict groups.</p>
        </div>
        <Switch
          id="calendar-settings-conflict"
          checked={normalizedSettings.filters.showConflictsOnly}
          onCheckedChange={(checked) => patchSettings({ filters: { ...normalizedSettings.filters, showConflictsOnly: checked } })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="calendar-settings-color-schedule">Schedule</Label>
          <Input
            id="calendar-settings-color-schedule"
            type="color"
            value={normalizedSettings.eventColors.schedule}
            onChange={(event) => patchSettings({ eventColors: { ...normalizedSettings.eventColors, schedule: event.target.value } })}
            className="h-10 w-full cursor-pointer"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calendar-settings-color-todo">Todo</Label>
          <Input
            id="calendar-settings-color-todo"
            type="color"
            value={normalizedSettings.eventColors.todo}
            onChange={(event) => patchSettings({ eventColors: { ...normalizedSettings.eventColors, todo: event.target.value } })}
            className="h-10 w-full cursor-pointer"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calendar-settings-color-custom">Custom</Label>
          <Input
            id="calendar-settings-color-custom"
            type="color"
            value={normalizedSettings.eventColors.custom}
            onChange={(event) => patchSettings({ eventColors: { ...normalizedSettings.eventColors, custom: event.target.value } })}
            className="h-10 w-full cursor-pointer"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => void Promise.resolve(updateSettings(DEFAULT_SETTINGS))}
        >
          Reset Calendar Settings
        </Button>
      </div>
    </div>
  );
};
