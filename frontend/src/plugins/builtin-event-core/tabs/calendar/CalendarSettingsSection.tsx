import React from 'react';
import { Download } from 'lucide-react';
import { SettingsSection } from '@/components/SettingsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
        headerAction={(
          <Button
            type="button"
            variant="outline"
            onClick={() => void Promise.resolve(updateSettings(DEFAULT_CALENDAR_SETTINGS))}
          >
            Reset Calendar Settings
          </Button>
        )}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="calendar-settings-skipped-mode">Skipped events</Label>
            <Select modal={false} value={normalizedSettings.skippedDisplay}
              onValueChange={(value) => patchSettings({ skippedDisplay: value as CalendarSettingsState['skippedDisplay'] })}
            >
              <SelectTrigger id="calendar-settings-skipped-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="grayed">Show as grayed</SelectItem>
                <SelectItem value="hidden">Hide skipped</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="calendar-settings-highlight-conflicts" className="cursor-pointer">Highlight conflicts</Label>
              <p className="text-xs text-muted-foreground">Use stronger visual emphasis for conflict events.</p>
            </div>
            <Switch
              id="calendar-settings-highlight-conflicts"
              checked={normalizedSettings.highlightConflicts}
              onCheckedChange={(checked) => patchSettings({ highlightConflicts: checked })}
            />
          </div>

          <div className="space-y-2">
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
        title="Schedule Export"
        description="Export semester or course schedule with filters and format options."
      >
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsExportModalOpen(true)}
            disabled={!semesterId}
          >
            <Download className="mr-2 h-4 w-4" />
            Open Export
          </Button>
        </div>
      </SettingsSection>

      {semesterId ? (
        <SemesterScheduleExportModal
          open={isExportModalOpen}
          onOpenChange={setIsExportModalOpen}
          semesterId={semesterId}
          maxWeek={maxWeek}
          courseOptions={courseOptions}
        />
      ) : null}
    </>
  );
};
