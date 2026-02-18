import * as React from 'react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface ColorPickerPreset {
  name: string;
  value: string;
}

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  defaultColor?: string;
  label?: React.ReactNode;
  id?: string;
  triggerAriaLabel?: string;
  presetColors?: readonly ColorPickerPreset[];
  resetLabel?: string;
  className?: string;
}

const DEFAULT_PRESET_COLORS: readonly ColorPickerPreset[] = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Orange', value: '#f59e0b' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
];

const isHexColor = (input: string) => /^#[0-9a-fA-F]{6}$/.test(input);

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  defaultColor,
  label,
  id,
  triggerAriaLabel = 'Choose color',
  presetColors = DEFAULT_PRESET_COLORS,
  resetLabel = 'Reset to default',
  className,
}) => {
  const [customColorInput, setCustomColorInput] = React.useState(value);

  React.useEffect(() => {
    setCustomColorInput(value);
  }, [value]);

  const colorInputId = id ? `${id}-native` : undefined;
  const hexInputId = id ? `${id}-hex` : undefined;
  const fallbackColor = isHexColor(value) ? value : defaultColor ?? '#3b82f6';

  return (
    <div className={cn('space-y-2', className)}>
      {label ? <Label htmlFor={colorInputId}>{label}</Label> : null}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2"
            aria-label={triggerAriaLabel}
          >
            <span
              className="h-5 w-5 rounded border"
              style={{ backgroundColor: fallbackColor }}
              aria-hidden="true"
            />
            <span className="font-mono text-xs">{value}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-72 space-y-3">
          {presetColors.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Preset colors</Label>
              <div className="grid grid-cols-6 gap-2">
                {presetColors.map((preset) => (
                  <button
                    key={`${preset.name}-${preset.value}`}
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
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={colorInputId} className="text-xs text-muted-foreground">
              Custom hex
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={colorInputId}
                type="color"
                value={fallbackColor}
                onChange={(event) => {
                  const nextColor = event.target.value;
                  setCustomColorInput(nextColor);
                  onChange(nextColor);
                }}
                className="h-10 w-14 cursor-pointer p-1"
              />
              <Input
                id={hexInputId}
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

          {defaultColor ? (
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
              {resetLabel}
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
};
