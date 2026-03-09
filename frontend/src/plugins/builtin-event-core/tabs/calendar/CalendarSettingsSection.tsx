// input:  [calendar settings state, settings update callback, schedule data hooks, shadcn settings/time-input UI primitives]
// output: [`CalendarSettingsSection` settings UI for calendar behavior, Reading Week week-number controls, colors, export, and reset actions]
// pos:    [Calendar tab settings panel entry that normalizes state and applies granular patches]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { Clock3, Download } from 'lucide-react';
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
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCalendarSourceRegistry } from '@/calendar-core';
import { useScheduleData } from '../../shared/hooks/useScheduleData';
import type { CalendarSettingsState } from '../../shared/types';
import { buildCourseOptions } from '../../shared/utils';
import { EventColorPicker } from './components/EventColorPicker';
import {
  DEFAULT_CALENDAR_SETTINGS,
  CALENDAR_TIME_INPUT_STEP_SECONDS,
  getScheduleEventColor,
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

const WEEK_VIEW_DAY_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

export const CalendarSettingsSection: React.FC<CalendarSettingsSectionProps> = ({ semesterId, settings, updateSettings }) => {
  const normalizedSettings = React.useMemo(() => normalizeCalendarSettings(settings), [settings]);
  const calendarSources = useCalendarSourceRegistry();
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [dayStartDraft, setDayStartDraft] = React.useState(() => toTimeInputValue(normalizedSettings.dayStartMinutes));
  const [dayEndDraft, setDayEndDraft] = React.useState(() => toTimeInputValue(normalizedSettings.dayEndMinutes));
  const timeInputClassName = 'appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none';
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

  React.useEffect(() => {
    setDayStartDraft(toTimeInputValue(normalizedSettings.dayStartMinutes));
  }, [normalizedSettings.dayStartMinutes]);

  React.useEffect(() => {
    setDayEndDraft(toTimeInputValue(normalizedSettings.dayEndMinutes));
  }, [normalizedSettings.dayEndMinutes]);

  const commitDayStartTime = (value: string) => {
    const parsed = parseTimeInputValue(value);
    if (parsed === null) {
      setDayStartDraft(toTimeInputValue(normalizedSettings.dayStartMinutes));
      return;
    }
    const minuteWindow = normalizeDayMinuteWindow(parsed, normalizedSettings.dayEndMinutes);
    patchSettings({
      dayStartMinutes: minuteWindow.dayStartMinutes,
      dayEndMinutes: minuteWindow.dayEndMinutes,
    });
  };

  const commitDayEndTime = (value: string) => {
    const parsed = parseTimeInputValue(value);
    if (parsed === null) {
      setDayEndDraft(toTimeInputValue(normalizedSettings.dayEndMinutes));
      return;
    }
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
          <div className="space-y-2">
            <div className="space-y-2">
              <Label htmlFor="calendar-settings-week-view-day-count">Days per screen</Label>
              <Select
                value={String(normalizedSettings.weekViewDayCount)}
                onValueChange={(value) => patchSettings({ weekViewDayCount: Number(value) })}
              >
                <SelectTrigger id="calendar-settings-week-view-day-count" className="w-full">
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
              <p className="text-sm text-muted-foreground">
                Keep the full week visible and enable horizontal scrolling when this is smaller than the week width.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="calendar-settings-day-start">Day start time</Label>
              <InputGroup>
                <InputGroupInput
                  id="calendar-settings-day-start"
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
                  className={timeInputClassName}
                />
                <InputGroupAddon align="inline-end" className="pr-2">
                  <Clock3 className="size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                </InputGroupAddon>
              </InputGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar-settings-day-end">Day end time</Label>
              <InputGroup>
                <InputGroupInput
                  id="calendar-settings-day-end"
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
                  className={timeInputClassName}
                />
                <InputGroupAddon align="inline-end" className="pr-2">
                  <Clock3 className="size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                </InputGroupAddon>
              </InputGroup>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="calendar-settings-count-reading-week" className="cursor-pointer text-base">Count Reading Week in week number</Label>
              <p className="text-sm text-muted-foreground">When disabled, weeks after Reading Week keep their academic numbering without counting the break week.</p>
            </div>
            <Switch
              id="calendar-settings-count-reading-week"
              checked={normalizedSettings.countReadingWeekInWeekNumber}
              onCheckedChange={(checked) => patchSettings({ countReadingWeekInWeekNumber: checked })}
            />
          </div>

          <div className="space-y-2 pt-2">
            <Label>Event source colors</Label>
            <div className="grid gap-3 lg:grid-cols-3">
              {calendarSources.map((source) => (
                <EventColorPicker
                  key={source.id}
                  source={source}
                  value={normalizedSettings.eventColors[source.id] ?? source.defaultColor}
                  onChange={(color) => patchSettings({ eventColors: { ...normalizedSettings.eventColors, [source.id]: color } })}
                />
              ))}
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Actions"
        description="Export schedule data or restore calendar defaults."
      >
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 mb-2 sm:mb-0">
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 mb-2 sm:mb-0">
              <p className="font-medium text-base">Restore defaults</p>
              <p className="text-sm text-muted-foreground">
                Restore event colors, week-view screen width, time window, weekend visibility, Reading Week numbering, and conflict highlighting to defaults.
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
          eventColor={getScheduleEventColor(normalizedSettings)}
        />
      ) : null}
    </>
  );
};
