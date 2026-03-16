// input:  [registered calendar sources, source visibility/color settings, LMS description safety state, and source-setting callbacks]
// output: [`CalendarSourceSettingsList` source list UI that combines enable toggles, colors, and per-source settings sections]
// pos:    [Calendar settings subcomponent that renders one integrated configuration card per registered Calendar source]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import type { CalendarSourceDefinition } from '@/calendar-core';
import { ColorPicker, type ColorPickerPreset } from '@/components/ui/color-picker';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BUILTIN_CALENDAR_SOURCE_LMS } from '../../../shared/constants';

const PRESET_COLORS: readonly ColorPickerPreset[] = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Orange', value: '#f59e0b' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
] as const;

interface CalendarSourceSettingsListProps {
  sources: CalendarSourceDefinition[];
  eventColors: Record<string, string>;
  sourceVisibility: Record<string, boolean>;
  renderUnsafeLmsDescriptionHtml: boolean;
  onToggleSourceVisibility: (sourceId: string, enabled: boolean) => void;
  onChangeSourceColor: (sourceId: string, color: string) => void;
  onToggleUnsafeLmsDescriptionHtml: (enabled: boolean) => void;
  onRequestEnableUnsafeLmsDescriptionHtml: () => void;
}

export const CalendarSourceSettingsList: React.FC<CalendarSourceSettingsListProps> = ({
  sources,
  eventColors,
  sourceVisibility,
  renderUnsafeLmsDescriptionHtml,
  onToggleSourceVisibility,
  onChangeSourceColor,
  onToggleUnsafeLmsDescriptionHtml,
  onRequestEnableUnsafeLmsDescriptionHtml,
}) => {
  return (
    <div className="space-y-3">
      {sources.map((source) => {
        const isEnabled = sourceVisibility[source.id] ?? true;
        const isLmsSource = source.id === BUILTIN_CALENDAR_SOURCE_LMS;
        const hasSourceSettings = isLmsSource;
        const sourceColorInputId = `calendar-source-color-${source.id}`;
        const sourceEnabledInputId = `calendar-source-enabled-${source.id}`;
        const lmsDescriptionInputId = `calendar-source-lms-description-${source.id}`;

        return (
          <div key={source.id} className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor={sourceEnabledInputId} className="cursor-pointer text-sm font-medium">
                  {source.label}
                </Label>
              </div>
              <Switch
                id={sourceEnabledInputId}
                checked={isEnabled}
                onCheckedChange={(checked) => onToggleSourceVisibility(source.id, checked)}
                className="shrink-0"
              />
            </div>

            <div className="mt-4 space-y-2">
              <ColorPicker
                id={sourceColorInputId}
                value={eventColors[source.id] ?? source.defaultColor}
                onChange={(color) => onChangeSourceColor(source.id, color)}
                defaultColor={source.defaultColor}
                presetColors={PRESET_COLORS}
                triggerAriaLabel={`Choose color for ${source.label}`}
              />
            </div>

            {hasSourceSettings ? (
              <div className="mt-4 border-t pt-3">
                <div className="mt-3 flex items-center justify-between gap-4 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                  <div className="space-y-1">
                    <Label htmlFor={lmsDescriptionInputId} className="cursor-pointer text-destructive">
                      render LMS description styles
                    </Label>
                    <p className="text-xs text-destructive/90">
                      Enable richer LMS HTML. This increases rendering risk.
                    </p>
                  </div>
                  <Switch
                    id={lmsDescriptionInputId}
                    checked={renderUnsafeLmsDescriptionHtml}
                    onCheckedChange={(checked) => {
                      if (!checked) {
                        onToggleUnsafeLmsDescriptionHtml(false);
                        return;
                      }
                      onRequestEnableUnsafeLmsDescriptionHtml();
                    }}
                    className="shrink-0 data-[state=checked]:bg-destructive"
                  />
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
