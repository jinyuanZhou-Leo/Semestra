"use no memo";

import React, { useCallback, useId, useState } from 'react';
import type { WidgetDefinition, WidgetProps, WidgetSettingsProps } from '../../services/widgetRegistry';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
    showRing?: boolean;
}

/**
 * Counter Settings Component
 */
const CounterSettingsComponent: React.FC<WidgetSettingsProps> = ({ settings, onSettingsChange }) => {
    const counterSettings = settings as CounterSettings;
    const formId = useId();

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-2">
                <Label htmlFor={`${formId}-display`}>Display Text</Label>
                <Input
                    id={`${formId}-display`}
                    value={counterSettings.displayText || ''}
                    onChange={e => onSettingsChange({ ...settings, displayText: e.target.value })}
                    placeholder="Enter custom text to display below counter"
                />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
                <Label htmlFor={`${formId}-show-ring`} className="cursor-pointer">
                    Show Ring
                </Label>
                <Checkbox
                    id={`${formId}-show-ring`}
                    checked={counterSettings.showRing ?? true}
                    onCheckedChange={(checked) =>
                        onSettingsChange({ ...settings, showRing: checked === true })
                    }
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                    <Label htmlFor={`${formId}-min`}>Min Value</Label>
                    <Input
                        id={`${formId}-min`}
                        type="number"
                        value={counterSettings.min ?? 0}
                        onChange={e => onSettingsChange({ ...settings, min: Number(e.target.value) })}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor={`${formId}-max`}>Max Value</Label>
                    <Input
                        id={`${formId}-max`}
                        type="number"
                        value={counterSettings.max ?? 100}
                        onChange={e => onSettingsChange({ ...settings, max: Number(e.target.value) })}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor={`${formId}-step`}>Step</Label>
                    <Input
                        id={`${formId}-step`}
                        type="number"
                        value={counterSettings.step ?? 1}
                        onChange={e => onSettingsChange({ ...settings, step: Number(e.target.value) })}
                        min="1"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor={`${formId}-initial`}>Initial Value</Label>
                    <Input
                        id={`${formId}-initial`}
                        type="number"
                        value={counterSettings.initialValue ?? 0}
                        onChange={e => onSettingsChange({ ...settings, initialValue: Number(e.target.value) })}
                    />
                </div>
            </div>
        </div>
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
        displayText = '',
        showRing = true
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

    const responsiveVars = {
        '--counter-gap': showRing ? 'clamp(0.35rem, 2.6vh, 0.75rem)' : 'clamp(0.25rem, 2vh, 0.6rem)',
        '--counter-pad': 'clamp(0.4rem, 3vw, 1rem)',
        '--counter-size': showRing ? 'clamp(4.75rem, 66%, 9rem)' : 'clamp(2.75rem, 40%, 5rem)',
        '--counter-number': showRing ? 'clamp(1.55rem, 15.5cqw, 3.5rem)' : 'clamp(2.1rem, 18cqw, 6rem)',
        '--counter-button': 'clamp(1.9rem, 12.5cqw, 2.5rem)',
        '--counter-icon': 'clamp(0.8rem, 5.2cqw, 1.25rem)',
        '--counter-text': 'clamp(0.6rem, 3.2cqw, 0.78rem)',
        '--counter-text-max': 'clamp(1.5rem, 14cqh, 3.2rem)',
        '--counter-controls-gap': showRing ? 'clamp(0.35rem, 2.8vw, 1rem)' : 'clamp(0.3rem, 2.2vw, 0.75rem)'
    } as React.CSSProperties;

    return (
        <div
            className="counter-widget flex h-full min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden"
            style={responsiveVars}
        >
            <div
                className={`relative flex shrink-0 items-center justify-center ${showRing ? 'w-[var(--counter-size)] h-[var(--counter-size)]' : 'h-[var(--counter-size)] w-full'}`}
                    style={{
                        animation: jitter ? 'jitter 0.3s ease-in-out' : 'none'
                    }}
                >
                {showRing && (
                    <svg className="h-full w-full text-muted/20 rotate-[-90deg]" viewBox="0 0 100 100">
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
                )}

                {/* Centered Value */}
                <div className="absolute inset-0 flex items-center justify-center px-2 text-center">
                    <span
                        className="font-bold leading-none tabular-nums tracking-tight"
                        style={{ fontSize: 'var(--counter-number)' }}
                    >
                        {value}
                    </span>
                </div>
            </div>

            <div className="w-full min-w-0 max-w-[220px] px-1 text-center">
                {displayText && (
                    <span className="block overflow-hidden whitespace-pre-wrap break-words font-medium leading-relaxed text-muted-foreground"
                        style={{
                            maxHeight: 'var(--counter-text-max)',
                            fontSize: 'var(--counter-text)'
                        }}>
                        {displayText}
                    </span>
                )}
            </div>

            <div className="flex shrink-0 items-center" style={{ gap: 'var(--counter-controls-gap)' }}>
                    <Button
                        onClick={handleDecrement}
                    variant="secondary"
                        size="icon"
                    className="rounded-full transition-colors hover:bg-destructive/10 hover:text-destructive"
                    style={{ width: 'var(--counter-button)', height: 'var(--counter-button)' }}
                    disabled={value <= min}
                    >
                    <Minus style={{ width: 'var(--counter-icon)', height: 'var(--counter-icon)' }} />
                    </Button>
                    <Button
                        onClick={handleIncrement}
                        size="icon"
                    className="rounded-full shadow-sm"
                    style={{ width: 'var(--counter-button)', height: 'var(--counter-button)' }}
                    disabled={value >= max}
                    >
                    <Plus style={{ width: 'var(--counter-icon)', height: 'var(--counter-icon)' }} />
                    </Button>
                </div>

            <style>{`
                    .counter-widget {
                        padding: var(--counter-pad);
                        gap: var(--counter-gap);
                        container-type: size;
                    }
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
        max: 10,
        step: 1,
        initialValue: 0,
        displayText: '',
        showRing: true
    },
    layout: { w: 3, h: 3, minW: 2, minH: 2, maxW: 4, maxH: 6 },
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
