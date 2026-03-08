// input:  [calendar source metadata, selected color value, and change callback]
// output: [`EventColorPicker` source-color field used by Calendar settings surfaces]
// pos:    [Calendar settings subcomponent that renders a labeled color picker for one registered Calendar source]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { Label } from '@/components/ui/label';
import { ColorPicker, type ColorPickerPreset } from '@/components/ui/color-picker';
import type { CalendarSourceDefinition } from '@/calendar-core';

const PRESET_COLORS: readonly ColorPickerPreset[] = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Orange', value: '#f59e0b' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
] as const;

interface EventColorPickerProps {
  source: Pick<CalendarSourceDefinition, 'id' | 'label' | 'defaultColor'>;
  value: string;
  onChange: (color: string) => void;
}

export const EventColorPicker: React.FC<EventColorPickerProps> = ({ source, value, onChange }) => {
  const colorInputId = `calendar-settings-color-${source.id}`;

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label htmlFor={colorInputId}>
        {source.label}
      </Label>
      <ColorPicker
        id={colorInputId}
        value={value}
        onChange={onChange}
        defaultColor={source.defaultColor}
        presetColors={PRESET_COLORS}
        triggerAriaLabel={`Choose color for ${source.label}`}
      />
    </div>
  );
};
