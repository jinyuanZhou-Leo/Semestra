import React, { useCallback, useId, useState } from 'react';
import type { WidgetDefinition, WidgetProps, WidgetSettingsProps } from '../../services/widgetRegistry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Minus, Plus, RotateCcw } from 'lucide-react';

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
 * Counter Plugin - Premium UI
 * Features: Circular progress, clean typography, responsive layout
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

    // Circular progress calculation
    const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
    const circumference = 2 * Math.PI * 40; // radius 40
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const updateCount = useCallback(async (newCount: number) => {
        await updateSettings({ ...settings, value: newCount });
    }, [settings, updateSettings]);

    const handleIncrement = useCallback(() => {
        const newValue = value + step;
        if (newValue <= max) {
            updateCount(newValue);
        } else {
            setJitter(true);
            setTimeout(() => setJitter(false), 300);
        }
    }, [value, step, max, updateCount]);

    const handleDecrement = useCallback(() => {
        const newValue = value - step;
        if (newValue >= min) {
            updateCount(newValue);
        } else {
            setJitter(true);
            setTimeout(() => setJitter(false), 300);
        }
    }, [value, step, min, updateCount]);

    return (
        <div className="flex h-full flex-col items-center justify-center p-4">
            <div 
                className="relative flex items-center justify-center"
                    style={{
                        animation: jitter ? 'jitter 0.3s ease-in-out' : 'none'
                    }}
                >
                {/* Circular Progress Background */}
                <svg className="h-40 w-40 text-muted/20 rotate-[-90deg]" viewBox="0 0 100 100">
                    <circle
                        className="text-muted/20"
                        strokeWidth="6"
                        stroke="currentColor"
                        fill="transparent"
                        r="40"
                        cx="50"
                        cy="50"
                    />
                    <circle
                        className="text-primary transition-all duration-500 ease-out"
                        strokeWidth="6"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r="40"
                        cx="50"
                        cy="50"
                    />
                </svg>

                {/* Centered Value */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold tabular-nums tracking-tight">
                        {value}
                    </span>
                    {displayText && (
                        <span className="max-w-[80px] truncate text-xs font-medium text-muted-foreground">
                            {displayText}
                        </span>
                    )}
                </div>
                </div>

            <div className="mt-4 flex items-center gap-4">
                    <Button
                        onClick={handleDecrement}
                    variant="secondary"
                        size="icon"
                    className="h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                    disabled={value <= min}
                    >
                    <Minus className="h-5 w-5" />
                    </Button>
                    <Button
                        onClick={handleIncrement}
                        size="icon"
                    className="h-10 w-10 rounded-full shadow-sm"
                    disabled={value >= max}
                    >
                    <Plus className="h-5 w-5" />
                    </Button>
                </div>

            <style>{`
                    @keyframes jitter {
                        0%, 100% { transform: translateX(0); }
                        25% { transform: translateX(-4px); }
                        75% { transform: translateX(4px); }
                    }
                `}</style>
        </div>
    );
};

export const Counter = CounterComponent;

export const CounterDefinition: WidgetDefinition = {
    type: 'counter',
    name: 'Counter',
    description: 'A premium counter with circular progress and limits.',
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
    layout: { w: 3, h: 4, minW: 2, minH: 3, maxW: 4, maxH: 6 },
    headerButtons: [
        {
            id: 'reset',
            icon: <RotateCcw className="h-4 w-4" />,
            title: 'Reset to initial value',
            onClick: ({ settings, updateSettings }) => {
                const counterSettings = settings as CounterSettings;
                updateSettings({ ...settings, value: counterSettings.initialValue });
            }
        }
    ]
};
