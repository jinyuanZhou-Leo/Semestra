import React, { useState, useEffect, useMemo } from 'react';
import type { WidgetDefinition, WidgetProps, WidgetSettingsProps } from '../../services/widgetRegistry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const AVAILABLE_TIMEZONES = [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'New York' },
    { value: 'Europe/London', label: 'London' },
    { value: 'Asia/Tokyo', label: 'Tokyo' },
    { value: 'Australia/Sydney', label: 'Sydney' },
    { value: 'Asia/Shanghai', label: 'Shanghai' },
];

/**
 * WorldClock Settings Component
 */
const WorldClockSettingsComponent: React.FC<WidgetSettingsProps> = ({ settings, onSave, onClose }) => {
    const [timezone, setTimezone] = useState(settings?.timezone || 'UTC');

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...settings, timezone });
        onClose();
    };

    return (
        <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="grid gap-2">
                <Label htmlFor="world-clock-timezone">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="world-clock-timezone" className="h-10 pr-8">
                        <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                        {AVAILABLE_TIMEZONES.map(tz => (
                            <SelectItem key={tz.value} value={tz.value}>
                                {tz.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
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
 * WorldClock Plugin - Memoized for performance
 * Internal timer state doesn't trigger parent re-renders
 */
const WorldClockComponent: React.FC<WidgetProps> = ({ settings }) => {
    const [time, setTime] = useState(new Date());

    // Default settings if not present
    const timezone = settings?.timezone || 'UTC';

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const timeFormatter = useMemo(() => new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: timezone,
        hour12: false
    }), [timezone]);

    const dateFormatter = useMemo(() => new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: timezone
    }), [timezone]);

    const formattedTime = timeFormatter.format(time);
    const formattedDate = dateFormatter.format(time);

    return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-3 text-center select-none">
            <Badge variant="secondary" className="text-xs">
                {timezone.split('/')[1]?.replace('_', ' ') || timezone}
            </Badge>
            <div className="text-4xl font-semibold leading-none tabular-nums tracking-tight">
                {formattedTime}
            </div>
            <Separator className="w-16" />
            <div className="text-sm text-muted-foreground">
                {formattedDate}
            </div>
        </div>
    );
};

export const WorldClock = WorldClockComponent;

export const WorldClockDefinition: WidgetDefinition = {
    type: 'world-clock',
    name: 'World Clock',
    description: 'Displays current time in a specific timezone.',
    icon: '🌍',
    component: WorldClock,
    SettingsComponent: WorldClockSettingsComponent,
    defaultSettings: { timezone: 'UTC' },
    layout: { w: 3, h: 3, minW: 2, minH: 2, maxW: 4, maxH: 4 }
};
