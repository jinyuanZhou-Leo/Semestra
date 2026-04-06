import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

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
              className="h-5 w-5 rounded border border-border/50"
              style={{ backgroundColor: fallbackColor }}
              aria-hidden="true"
            />
            <span className="font-mono text-xs">{value}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-72 space-y-3">
          {presetColors.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Preset colors</Label>
              <div className="grid grid-cols-6 gap-2">
                {presetColors.map((preset) => {
                  const isSelected = value.toLowerCase() === preset.value.toLowerCase();
                  return (
                    <button
                      key={`${preset.name}-${preset.value}`}
                      type="button"
                      className={cn(
                        'relative h-8 w-8 rounded-md border-2 transition-all hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                        isSelected ? 'border-primary shadow-md' : 'border-border/50 hover:border-border',
                      )}
                      style={{ backgroundColor: preset.value }}
                      onClick={() => onChange(preset.value)}
                      aria-label={`${preset.name} color`}
                      title={preset.name}
                    >
                      {isSelected && (
                        <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-md" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <Separator />

          <div className="space-y-3">
            <Label htmlFor={colorInputId} className="text-xs font-medium text-muted-foreground">
              Custom color
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
                className="h-10 w-16 cursor-pointer border p-1"
              />
              <Input
                id={hexInputId}
                value={customColorInput}
                onChange={(event) => setCustomColorInput(event.target.value)}
                onBlur={() => {
                  const nextColor = customColorInput.trim().toUpperCase();
                  if (!isHexColor(nextColor)) {
                    setCustomColorInput(value);
                    return;
                  }
                  onChange(nextColor);
                }}
                placeholder="#3B82F6"
                className="font-mono text-xs"
              />
            </div>
          </div>

          {defaultColor ? (
            <>
              <Separator />
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
            </>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
};
