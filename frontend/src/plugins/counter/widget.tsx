import React, { useCallback, useId, useState } from 'react';
import type { WidgetDefinition, WidgetProps, WidgetSettingsProps } from '../../services/widgetRegistry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CounterSettings {
    value: number;
    min: number;
    max: number;
    step: number;
    initialValue: number;
    displayText?: string;
}

/**
 * Counter Settings Component
 */
const CounterSettingsComponent: React.FC<WidgetSettingsProps> = ({ settings, onSave, onClose }) => {
    const counterSettings = settings as CounterSettings;
    const formId = useId();
    const [displayText, setDisplayText] = useState(counterSettings.displayText || '');
    const [min, setMin] = useState(counterSettings.min ?? 0);
    const [max, setMax] = useState(counterSettings.max ?? 100);
    const [step, setStep] = useState(counterSettings.step ?? 1);
    const [initialValue, setInitialValue] = useState(counterSettings.initialValue ?? 0);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...settings,
            displayText,
            min: Number(min),
            max: Number(max),
            step: Number(step),
            initialValue: Number(initialValue)
        });
        onClose();
    };

    return (
        <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="grid gap-2">
                <Label htmlFor={`${formId}-display`}>Display Text</Label>
                <Input
                    id={`${formId}-display`}
                    value={displayText}
                    onChange={e => setDisplayText(e.target.value)}
                    placeholder="Enter custom text to display below counter"
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                    <Label htmlFor={`${formId}-min`}>Min Value</Label>
                    <Input
                        id={`${formId}-min`}
                        type="number"
                        value={min}
                        onChange={e => setMin(Number(e.target.value))}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor={`${formId}-max`}>Max Value</Label>
                    <Input
                        id={`${formId}-max`}
                        type="number"
                        value={max}
                        onChange={e => setMax(Number(e.target.value))}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor={`${formId}-step`}>Step</Label>
                    <Input
                        id={`${formId}-step`}
                        type="number"
                        value={step}
                        onChange={e => setStep(Number(e.target.value))}
                        min="1"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor={`${formId}-initial`}>Initial Value</Label>
                    <Input
                        id={`${formId}-initial`}
                        type="number"
                        value={initialValue}
                        onChange={e => setInitialValue(Number(e.target.value))}
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-1">
                <Button type="button" variant="secondary" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit">Save</Button>
            </div>
        </form>
    );
};

/**
 * Counter Plugin - A customizable counter with bounds and jitter animation
 * Features: min/max bounds, step value, reset functionality, custom display text
 */
const CounterComponent: React.FC<WidgetProps> = ({ settings, updateSettings }) => {
    const {
        value = 0,
        min = 0,
        max = 100,
        step = 1,
        displayText = ''
    } = (settings as CounterSettings) || {};

    const [jitter, setJitter] = useState(false);

    // Memoize updateCount to prevent recreating on each render
    const updateCount = useCallback(async (newCount: number) => {
        // Optimistic UI is handled by parent (useDashboardWidgets hook)
        await updateSettings({ ...settings, value: newCount });
    }, [settings, updateSettings]);

    const handleIncrement = useCallback(() => {
        const newValue = value + step;
        if (newValue <= max) {
            updateCount(newValue);
        } else {
            // Trigger jitter animation when hitting max
            setJitter(true);
            setTimeout(() => setJitter(false), 300);
        }
    }, [value, step, max, updateCount]);

    const handleDecrement = useCallback(() => {
        const newValue = value - step;
        if (newValue >= min) {
            updateCount(newValue);
        } else {
            // Trigger jitter animation when hitting min
            setJitter(true);
            setTimeout(() => setJitter(false), 300);
        }
    }, [value, step, min, updateCount]);

    return (
        <div
            className="counter-container h-full w-full overflow-hidden"
            style={{
                containerType: 'size',
                containerName: 'counter'
            }}
        >
            <div className="counter-content flex h-full w-full flex-col items-center justify-center gap-3 overflow-auto p-3 select-none">
                <div
                    className="counter-value text-5xl font-semibold leading-none tabular-nums"
                    style={{
                        animation: jitter ? 'jitter 0.3s ease-in-out' : 'none'
                    }}
                >
                    {value}
                </div>

                <div className="counter-buttons flex items-center gap-2">
                    <Button
                        onClick={handleDecrement}
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 text-lg"
                    >
                        -
                    </Button>
                    <Button
                        onClick={handleIncrement}
                        size="icon"
                        className="h-10 w-10 text-lg"
                    >
                        +
                    </Button>
                </div>

                {displayText && (
                    <div className="counter-text max-w-[90%] text-center text-sm text-muted-foreground">
                        {displayText}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes jitter {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    50% { transform: translateX(5px); }
                    75% { transform: translateX(-5px); }
                }

                /* Container queries for true responsive design based on widget size */
                @container counter (max-height: 200px) {
                    .counter-value {
                        font-size: 2rem !important;
                    }
                    .counter-buttons button {
                        min-width: 1.75rem !important;
                        min-height: 1.75rem !important;
                        font-size: 1rem !important;
                        padding: 0.3rem !important;
                    }
                    .counter-text {
                        font-size: 0.75rem !important;
                    }
                }

                @container counter (max-height: 150px) {
                    .counter-value {
                        font-size: 1.5rem !important;
                    }
                    .counter-buttons {
                        gap: 0.3rem !important;
                    }
                    .counter-buttons button {
                        min-width: 1.5rem !important;
                        min-height: 1.5rem !important;
                        font-size: 0.875rem !important;
                        padding: 0.25rem !important;
                    }
                    .counter-text {
                        font-size: 0.7rem !important;
                    }
                    .counter-content {
                        gap: 0.4rem !important;
                        padding: 0.4rem !important;
                    }
                }

                @container counter (max-width: 200px) {
                    .counter-value {
                        font-size: 2.5rem !important;
                    }
                    .counter-buttons button {
                        min-width: 2rem !important;
                        min-height: 2rem !important;
                    }
                }

                @container counter (max-width: 150px) {
                    .counter-value {
                        font-size: 2rem !important;
                    }
                    .counter-buttons button {
                        min-width: 1.75rem !important;
                        min-height: 1.75rem !important;
                        font-size: 0.9rem !important;
                    }
                }
            `}</style>
        </div>
    );
};

export const Counter = CounterComponent;

export const CounterDefinition: WidgetDefinition = {
    type: 'counter',
    name: 'Counter',
    description: 'A customizable counter with min/max bounds, step value, and reset functionality.',
    icon: '🔢',
    component: Counter,
    SettingsComponent: CounterSettingsComponent,
    defaultSettings: {
        value: 0,
        min: 0,
        max: 100,
        step: 1,
        initialValue: 0,
        displayText: ''
    },
    layout: { w: 3, h: 3, minW: 2, minH: 2, maxW: 4, maxH: 4 },
    headerButtons: [
        {
            id: 'reset',
            icon: '↺',
            title: 'Reset to initial value',
            onClick: ({ settings, updateSettings }) => {
                const counterSettings = settings as CounterSettings;
                updateSettings({ ...settings, value: counterSettings.initialValue });
            }
        }
    ]
};
