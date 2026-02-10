import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CALENDAR_EVENT_DEFAULT_COLORS } from '../../../shared/constants';
import type { EventSource } from '../../../shared/types';

const PRESET_COLORS = [
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

const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

export const EventColorPicker: React.FC<EventColorPickerProps> = ({ source, value, onChange }) => {
  const [customColorInput, setCustomColorInput] = React.useState(value);

  React.useEffect(() => {
    setCustomColorInput(value);
  }, [value]);

  const defaultColor = CALENDAR_EVENT_DEFAULT_COLORS[source];

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label htmlFor={`calendar-settings-color-${source}`} className="capitalize">
        {source} events
      </Label>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2"
            aria-label={`Choose color for ${source} events`}
          >
            <span
              className="h-5 w-5 rounded border"
              style={{ backgroundColor: value }}
              aria-hidden="true"
            />
            <span className="font-mono text-xs">{value}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-72 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Preset colors</Label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={`${source}-${preset.value}`}
                  type="button"
                  className={[
                    'h-8 w-8 rounded border-2 transition-transform hover:scale-105',
                    'focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none',
                    value.toLowerCase() === preset.value.toLowerCase() ? 'border-primary' : 'border-border',
                  ].join(' ')}
                  style={{ backgroundColor: preset.value }}
                  onClick={() => onChange(preset.value)}
                  aria-label={`${preset.name} color`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`calendar-settings-color-${source}`} className="text-xs text-muted-foreground">
              Custom hex
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={`calendar-settings-color-${source}`}
                type="color"
                value={isHexColor(value) ? value : defaultColor}
                onChange={(event) => {
                  const nextColor = event.target.value;
                  setCustomColorInput(nextColor);
                  onChange(nextColor);
                }}
                className="h-10 w-14 cursor-pointer p-1"
              />
              <Input
                value={customColorInput}
                onChange={(event) => setCustomColorInput(event.target.value)}
                onBlur={() => {
                  const nextColor = customColorInput.trim();
                  if (!isHexColor(nextColor)) {
                    setCustomColorInput(value);
                    return;
                  }
                  onChange(nextColor);
                }}
                placeholder="#3b82f6"
                className="font-mono text-xs"
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setCustomColorInput(defaultColor);
              onChange(defaultColor);
            }}
          >
            Reset to default
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
};

