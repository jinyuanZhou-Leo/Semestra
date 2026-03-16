// input:  [calendar settings state, settings update callback, schedule data hooks, shadcn settings/time-input UI primitives, and registered calendar sources]
// output: [`CalendarSettingsSection` settings UI for calendar behavior, source list visibility/color controls, LMS description safety, Reading Week week-number controls, export, and reset actions]
// pos:    [Calendar tab settings panel entry that normalizes state, applies granular patches, and uses shadcn Field-based form structure for standard controls plus source-aware list controls]
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCalendarSourceRegistry } from '@/calendar-core';
import { useScheduleData } from '../../shared/hooks/useScheduleData';
import type { CalendarSettingsState } from '../../shared/types';
import { buildCourseOptions } from '../../shared/utils';
import { CalendarSourceSettingsList } from './components/CalendarSourceSettingsList';
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
  const [isLmsDescriptionRiskDialogOpen, setIsLmsDescriptionRiskDialogOpen] = React.useState(false);
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
      sourceVisibility: {
        ...normalizedSettings.sourceVisibility,
        ...(patch.sourceVisibility ?? {}),
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
          <FieldSet>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="calendar-settings-week-view-day-count">Days per screen</FieldLabel>
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
                <FieldDescription>
                  Keep the full week visible and enable horizontal scrolling when this is smaller than the week width.
                </FieldDescription>
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="calendar-settings-day-start">Day start time</FieldLabel>
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
                </Field>
                <Field>
                  <FieldLabel htmlFor="calendar-settings-day-end">Day end time</FieldLabel>
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
                </Field>
              </div>

              <Field orientation="responsive">
                <FieldContent>
                  <FieldLabel htmlFor="calendar-settings-highlight-conflicts">Highlight conflicts</FieldLabel>
                  <FieldDescription>Use stronger visual emphasis for conflict events.</FieldDescription>
                </FieldContent>
                <Switch
                  id="calendar-settings-highlight-conflicts"
                  checked={normalizedSettings.highlightConflicts}
                  onCheckedChange={(checked) => patchSettings({ highlightConflicts: checked })}
                  className="shrink-0"
                />
              </Field>

              <Field orientation="responsive">
                <FieldContent>
                  <FieldLabel htmlFor="calendar-settings-show-weekends">Show weekends</FieldLabel>
                  <FieldDescription>Display Saturday and Sunday columns in calendar views.</FieldDescription>
                </FieldContent>
                <Switch
                  id="calendar-settings-show-weekends"
                  checked={normalizedSettings.showWeekends}
                  onCheckedChange={(checked) => patchSettings({ showWeekends: checked })}
                  className="shrink-0"
                />
              </Field>

              <Field orientation="responsive">
                <FieldContent>
                  <FieldLabel htmlFor="calendar-settings-count-reading-week">Count Reading Week in week number</FieldLabel>
                  <FieldDescription>When disabled, weeks after Reading Week keep their academic numbering without counting the break week.</FieldDescription>
                </FieldContent>
                <Switch
                  id="calendar-settings-count-reading-week"
                  checked={normalizedSettings.countReadingWeekInWeekNumber}
                  onCheckedChange={(checked) => patchSettings({ countReadingWeekInWeekNumber: checked })}
                  className="shrink-0"
                />
              </Field>

            </FieldGroup>
          </FieldSet>

          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium">calendar sources</p>
            <CalendarSourceSettingsList
              sources={calendarSources}
              eventColors={normalizedSettings.eventColors}
              sourceVisibility={normalizedSettings.sourceVisibility}
              renderUnsafeLmsDescriptionHtml={normalizedSettings.renderUnsafeLmsDescriptionHtml}
              onToggleSourceVisibility={(sourceId, enabled) => patchSettings({ sourceVisibility: { [sourceId]: enabled } })}
              onChangeSourceColor={(sourceId, color) => patchSettings({ eventColors: { [sourceId]: color } })}
              onToggleUnsafeLmsDescriptionHtml={(enabled) => patchSettings({ renderUnsafeLmsDescriptionHtml: enabled })}
              onRequestEnableUnsafeLmsDescriptionHtml={() => setIsLmsDescriptionRiskDialogOpen(true)}
            />
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

      <AlertDialog open={isLmsDescriptionRiskDialogOpen} onOpenChange={setIsLmsDescriptionRiskDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Enable rich LMS descriptions?</AlertDialogTitle>
            <AlertDialogDescription>
              LMS description HTML can include richer formatting from external systems. Only enable this if you trust the upstream LMS content, because it increases rendering risk compared with the default safe text/list mode.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Safe Mode</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => patchSettings({ renderUnsafeLmsDescriptionHtml: true })}
            >
              Enable Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
