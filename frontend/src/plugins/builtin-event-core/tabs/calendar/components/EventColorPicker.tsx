"use no memo";

import React from 'react';
import { Label } from '@/components/ui/label';
import { ColorPicker, type ColorPickerPreset } from '@/components/ui/color-picker';
import { CALENDAR_EVENT_DEFAULT_COLORS } from '../../../shared/constants';
import type { EventSource } from '../../../shared/types';

const PRESET_COLORS: readonly ColorPickerPreset[] = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Orange', value: '#f59e0b' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
] as const;

interface EventColorPickerProps {
  source: EventSource;
  value: string;
  onChange: (color: string) => void;
}

export const EventColorPicker: React.FC<EventColorPickerProps> = ({ source, value, onChange }) => {
  const defaultColor = CALENDAR_EVENT_DEFAULT_COLORS[source];
  const colorInputId = `calendar-settings-color-${source}`;

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label htmlFor={colorInputId} className="capitalize">
        {source} events
      </Label>
      <ColorPicker
        id={colorInputId}
        value={value}
        onChange={onChange}
        defaultColor={defaultColor}
        presetColors={PRESET_COLORS}
        triggerAriaLabel={`Choose color for ${source} events`}
      />
    </div>
  );
};
