"use no memo";

import React from 'react';
import { Download } from 'lucide-react';
import { SettingsSection } from '@/components/SettingsSection';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useScheduleData } from '../../shared/hooks/useScheduleData';
import type { CalendarSettingsState } from '../../shared/types';
import { buildCourseOptions } from '../../shared/utils';
import { EventColorPicker } from './components/EventColorPicker';
import {
  DEFAULT_CALENDAR_SETTINGS,
  normalizeDayMinuteWindow,
  normalizeCalendarSettings,
  parseTimeInputValue,
  toTimeInputValue,
} from './settings';
import { SemesterScheduleExportModal } from './SemesterScheduleExportModal';

interface CalendarSettingsSectionProps {
  semesterId?: string;
  settings: unknown;
  updateSettings: (newSettings: CalendarSettingsState) => void | Promise<void>;
}

export const CalendarSettingsSection: React.FC<CalendarSettingsSectionProps> = ({ semesterId, settings, updateSettings }) => {
  const normalizedSettings = React.useMemo(() => normalizeCalendarSettings(settings), [settings]);
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const { items, maxWeek } = useScheduleData({
    semesterId,
    mode: 'all-weeks',
    enabled: Boolean(semesterId),
    withConflicts: true,
  });

  const courseOptions = React.useMemo(() => buildCourseOptions(items), [items]);

  const patchSettings = (patch: Partial<CalendarSettingsState>) => {
    const nextSettings: CalendarSettingsState = {
      ...normalizedSettings,
      ...patch,
      eventColors: {
        ...normalizedSettings.eventColors,
        ...(patch.eventColors ?? {}),
      },
    };

    void Promise.resolve(updateSettings(nextSettings));
  };

  const updateDayStartTime = (value: string) => {
    const parsed = parseTimeInputValue(value);
    if (parsed === null) return;
    const minuteWindow = normalizeDayMinuteWindow(parsed, normalizedSettings.dayEndMinutes);
    patchSettings({
      dayStartMinutes: minuteWindow.dayStartMinutes,
      dayEndMinutes: minuteWindow.dayEndMinutes,
    });
  };

  const updateDayEndTime = (value: string) => {
    const parsed = parseTimeInputValue(value);
    if (parsed === null) return;
    const minuteWindow = normalizeDayMinuteWindow(normalizedSettings.dayStartMinutes, parsed);
    patchSettings({
      dayStartMinutes: minuteWindow.dayStartMinutes,
      dayEndMinutes: minuteWindow.dayEndMinutes,
    });
  };

  return (
    <>
      <SettingsSection
        title="Calendar"
        description="Configure visibility and source colors for the calendar tab."
      >
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="calendar-settings-day-start">Day start time</Label>
              <Input
                id="calendar-settings-day-start"
                type="time"
                step={1800}
                value={toTimeInputValue(normalizedSettings.dayStartMinutes)}
                onChange={(event) => updateDayStartTime(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar-settings-day-end">Day end time</Label>
              <Input
                id="calendar-settings-day-end"
                type="time"
                step={1800}
                value={toTimeInputValue(normalizedSettings.dayEndMinutes)}
                onChange={(event) => updateDayEndTime(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="calendar-settings-highlight-conflicts" className="cursor-pointer text-base">Highlight conflicts</Label>
              <p className="text-sm text-muted-foreground">Use stronger visual emphasis for conflict events.</p>
            </div>
            <Switch
              id="calendar-settings-highlight-conflicts"
              checked={normalizedSettings.highlightConflicts}
              onCheckedChange={(checked) => patchSettings({ highlightConflicts: checked })}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="calendar-settings-show-weekends" className="cursor-pointer text-base">Show weekends</Label>
              <p className="text-sm text-muted-foreground">Display Saturday and Sunday columns in calendar views.</p>
            </div>
            <Switch
              id="calendar-settings-show-weekends"
              checked={normalizedSettings.showWeekends}
              onCheckedChange={(checked) => patchSettings({ showWeekends: checked })}
            />
          </div>

          <div className="space-y-2 pt-2">
            <Label>Event source colors</Label>
            <div className="grid gap-3 lg:grid-cols-3">
              <EventColorPicker
                source="schedule"
                value={normalizedSettings.eventColors.schedule}
                onChange={(color) => patchSettings({ eventColors: { ...normalizedSettings.eventColors, schedule: color } })}
              />
              <EventColorPicker
                source="todo"
                value={normalizedSettings.eventColors.todo}
                onChange={(color) => patchSettings({ eventColors: { ...normalizedSettings.eventColors, todo: color } })}
              />
              <EventColorPicker
                source="custom"
                value={normalizedSettings.eventColors.custom}
                onChange={(color) => patchSettings({ eventColors: { ...normalizedSettings.eventColors, custom: color } })}
              />
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Actions"
        description="Export schedule data or restore calendar defaults."
      >
        <div className="space-y-3">
          <div className="flex flex-col justify-between rounded-lg border p-4 shadow-sm">
            <div className="space-y-2 mb-4">
              <p className="font-medium text-base">Export Schedule</p>
              <p className="text-sm text-muted-foreground">
                Export your semester schedule data.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsExportModalOpen(true)}
              disabled={!semesterId}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Schedule
            </Button>
          </div>

          <div className="flex flex-col justify-between rounded-lg border p-4 shadow-sm">
            <div className="space-y-2 mb-4">
              <p className="font-medium text-base">Restore defaults</p>
              <p className="text-sm text-muted-foreground">
                Restore event colors, time window, weekend visibility, and conflict highlighting to defaults.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive">
                  Reset Calendar Settings
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset calendar settings?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reset calendar colors, time window, weekend visibility, and conflict highlighting to defaults.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => void Promise.resolve(updateSettings(DEFAULT_CALENDAR_SETTINGS))}
                  >
                    Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SettingsSection>

      {semesterId ? (
        <SemesterScheduleExportModal
          open={isExportModalOpen}
          onOpenChange={setIsExportModalOpen}
          semesterId={semesterId}
          maxWeek={maxWeek}
          courseOptions={courseOptions}
          dayStartMinutes={normalizedSettings.dayStartMinutes}
          dayEndMinutes={normalizedSettings.dayEndMinutes}
          eventColor={normalizedSettings.eventColors.schedule}
        />
      ) : null}
    </>
  );
};
