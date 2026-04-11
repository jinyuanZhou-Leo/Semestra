// input:  [plugin settings bucket for calendar tab, registered calendar sources, semester detail cache, and shadcn settings/alert-dialog primitives]
// output: [`CalendarSettingsSection` self-contained settings panel that reads and writes calendar settings directly via the plugin settings bucket, with source list controls, LMS description safety, and export/reset actions]
// pos:    [Calendar tab settings panel entry — fully decoupled from the host TabProps.settings/updateSettings chain; reads resolved settings from the plugin settings inheritance chain and writes scoped overrides via the bucket]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { queryKeys } from '@/services/queryKeys';
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
  FieldGroup,
  FieldSet,
} from '@/components/ui/field';
import { useCalendarSourceRegistry } from '../../calendar-core';
import {
  PluginSettingsBooleanField,
  PluginSettingsSelectField,
  PluginSettingsTimeField,
  usePluginSettingsBucket,
} from '@/plugin-sdk';
import type { CalendarSettingsState } from '../../shared/types';
import { getWeekFromSemesterDate, resolveSemesterDateRange } from '../../shared/utils';
import { CalendarSourceSettingsList } from './components/CalendarSourceSettingsList';
import {
  getScheduleEventColor,
  normalizeDayMinuteWindow,
  normalizeCalendarSettings,
} from './settings';
import { SemesterScheduleExportModal } from './SemesterScheduleExportModal';
import {
  BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  CALENDAR_DEFAULT_END_MINUTES,
  CALENDAR_DEFAULT_START_MINUTES,
} from '../../shared/constants';

interface CalendarSettingsSectionProps {
  semesterId?: string;
}

const WEEK_VIEW_DAY_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const WEEK_VIEW_DAY_COUNT_SELECT_OPTIONS = WEEK_VIEW_DAY_COUNT_OPTIONS.map((dayCount) => ({
  label: `${dayCount} day${dayCount === 1 ? '' : 's'}`,
  value: String(dayCount),
}));
const FALLBACK_MAX_WEEK = 16;

interface CachedSemesterDetail {
  start_date?: string | null;
  end_date?: string | null;
  reading_week_start?: string | null;
  reading_week_end?: string | null;
  courses?: Array<{ id: string; name: string }>;
}

export const CalendarSettingsSection: React.FC<CalendarSettingsSectionProps> = ({
  semesterId,
}) => {
  const queryClient = useQueryClient();
  const bucket = usePluginSettingsBucket(BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE);

  // Derived from bucket for complex-field patches and export/reset
  const normalizedSettings = React.useMemo(
    () => normalizeCalendarSettings(bucket.resolvedSettings),
    [bucket.resolvedSettings],
  );

  const calendarSources = useCalendarSourceRegistry();
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [isLmsDescriptionRiskDialogOpen, setIsLmsDescriptionRiskDialogOpen] = React.useState(false);

  const cachedSemester = React.useMemo(() => {
    if (!semesterId) return null;
    return queryClient.getQueryData<CachedSemesterDetail>(queryKeys.semesters.detail(semesterId)) ?? null;
  }, [queryClient, semesterId]);
  const maxWeek = React.useMemo(() => {
    if (!cachedSemester) return FALLBACK_MAX_WEEK;
    const semesterRange = resolveSemesterDateRange(
      cachedSemester.start_date,
      cachedSemester.end_date,
      FALLBACK_MAX_WEEK,
      cachedSemester.reading_week_start,
      cachedSemester.reading_week_end,
    );
    return Math.max(1, getWeekFromSemesterDate(semesterRange.startDate, semesterRange.endDate));
  }, [cachedSemester]);
  const courseOptions = React.useMemo(() => {
    return (cachedSemester?.courses ?? []).map((course) => ({
      id: course.id,
      name: course.name,
    }));
  }, [cachedSemester]);

  /**
   * Patch a subset of calendar settings.
   * Only the patched keys are written to the scope bucket; other scope overrides
   * are preserved, and inherited defaults are never baked in as explicit overrides.
   * Complex fields (eventColors, sourceVisibility) are merged onto current resolved
   * values before writing to avoid losing sibling entries.
   */
  const patchSettings = React.useCallback((patch: Partial<CalendarSettingsState>) => {
    // Merge complex fields; keep other patch keys verbatim
    const fullPatch: Partial<CalendarSettingsState> = { ...patch };
    if (patch.eventColors !== undefined) {
      fullPatch.eventColors = { ...normalizedSettings.eventColors, ...patch.eventColors };
    }
    if (patch.sourceVisibility !== undefined) {
      fullPatch.sourceVisibility = { ...normalizedSettings.sourceVisibility, ...patch.sourceVisibility };
    }
    // Merge onto existing scope settings so only the patched keys become overrides
    void bucket.setSettings({ ...bucket.scopeSettings, ...fullPatch });
  }, [normalizedSettings, bucket]);

  return (
    <>
      <SettingsSection
        title="Calendar"
        description="Configure visibility and source colors for the calendar tab."
      >
        <div className="space-y-5">
          <FieldSet>
            <FieldGroup>
              <PluginSettingsSelectField
                settingsKey={BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE}
                fieldPath="weekViewDayCount"
                label="Days per screen"
                description="Keep the full week visible and enable horizontal scrolling when this is smaller than the week width."
                placeholder="Select visible days"
                options={WEEK_VIEW_DAY_COUNT_SELECT_OPTIONS}
                defaultValue="5"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <PluginSettingsTimeField
                  settingsKey={BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE}
                  fieldPath="dayStartMinutes"
                  label="Day start time"
                  defaultValue={CALENDAR_DEFAULT_START_MINUTES}
                  onCommit={(minutes) => {
                    const w = normalizeDayMinuteWindow(minutes, normalizedSettings.dayEndMinutes);
                    patchSettings({ dayStartMinutes: w.dayStartMinutes, dayEndMinutes: w.dayEndMinutes });
                  }}
                />
                <PluginSettingsTimeField
                  settingsKey={BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE}
                  fieldPath="dayEndMinutes"
                  label="Day end time"
                  defaultValue={CALENDAR_DEFAULT_END_MINUTES}
                  onCommit={(minutes) => {
                    const w = normalizeDayMinuteWindow(normalizedSettings.dayStartMinutes, minutes);
                    patchSettings({ dayStartMinutes: w.dayStartMinutes, dayEndMinutes: w.dayEndMinutes });
                  }}
                />
              </div>

              <PluginSettingsBooleanField
                settingsKey={BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE}
                fieldPath="highlightConflicts"
                label="Highlight conflicts"
                description="Use stronger visual emphasis for conflict events."
                defaultValue={true}
              />

              <PluginSettingsBooleanField
                settingsKey={BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE}
                fieldPath="showWeekends"
                label="Show weekends"
                description="Display Saturday and Sunday columns in calendar views."
                defaultValue={true}
              />

              <PluginSettingsBooleanField
                settingsKey={BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE}
                fieldPath="countReadingWeekInWeekNumber"
                label="Count Reading Week in week number"
                description="When disabled, weeks after Reading Week keep their academic numbering without counting the break week."
                defaultValue={false}
              />

            </FieldGroup>
          </FieldSet>

          <div className="space-y-2 pt-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Calendar sources</p>
            </div>
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
                    onClick={() => {
                      // Clear all scope-level overrides so every field falls back to
                      // inherited / default values — equivalent to Reset All.
                      void bucket.setSettings({});
                    }}
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
          highlightConflicts={normalizedSettings.highlightConflicts}
          showWeekends={normalizedSettings.showWeekends}
          weekViewDayCount={normalizedSettings.weekViewDayCount}
        />
      ) : null}
    </>
  );
};
