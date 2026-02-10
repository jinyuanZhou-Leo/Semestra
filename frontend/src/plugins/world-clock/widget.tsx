import React, { useState, useEffect, useMemo } from 'react';
import type { WidgetDefinition, WidgetProps, WidgetSettingsProps } from '../../services/widgetRegistry';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, Calendar, Globe } from 'lucide-react';

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
const WorldClockSettingsComponent: React.FC<WidgetSettingsProps> = ({ settings, onSettingsChange }) => {
    const showSeconds = settings?.showSeconds ?? true;

    return (
        <div className="grid gap-4">
            <div className="grid gap-2">
                <Label htmlFor="world-clock-timezone">Timezone</Label>
                <Select modal={false} value={settings?.timezone || 'UTC'}
                    onValueChange={(timezone) => onSettingsChange({ ...settings, timezone })}
                >
                    <SelectTrigger id="world-clock-timezone" className="h-10 pr-8">
                        <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                        {AVAILABLE_TIMEZONES.map(tz => (
                            <SelectItem key={tz.value} value={tz.value}>
                                {tz.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
                <Label htmlFor="world-clock-show-seconds" className="cursor-pointer">
                    Show Seconds
                </Label>
                <Checkbox
                    id="world-clock-show-seconds"
                    checked={showSeconds}
                    onCheckedChange={(checked) =>
                        onSettingsChange({ ...settings, showSeconds: checked === true })
                    }
                />
            </div>
        </div>
    );
};

/**
 * WorldClock Plugin - Premium UI
 * Features: Digital clock aesthetic, day/night improvements, clear typography
 */
const WorldClockComponent: React.FC<WidgetProps> = ({ settings }) => {
    const [time, setTime] = useState(new Date());

    // Default settings if not present
    const timezone = settings?.timezone || 'UTC';
    const showSeconds = settings?.showSeconds ?? true;

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const timeFormatter = useMemo(() => {
        const options: Intl.DateTimeFormatOptions = {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: timezone,
            hour12: false
        };
        if (showSeconds) {
            options.second = '2-digit';
        }
        return new Intl.DateTimeFormat('en-US', options);
    }, [timezone, showSeconds]);

    const dateFormatter = useMemo(() => new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: timezone
    }), [timezone]);

    const formattedTime = timeFormatter.format(time);
    const formattedDate = dateFormatter.format(time);



    return (
        <div className="flex h-full w-full flex-col items-center justify-center p-4">
            <div className="flex flex-col items-center gap-2">
                <Badge
                    variant="secondary"
                    className="flex items-center gap-1.5 border-0 px-2.5 py-0.5 text-[10px] bg-background/50 backdrop-blur-sm uppercase tracking-wider font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                    <Globe className="h-3 w-3" />
                    {timezone.split('/')[1]?.replace('_', ' ') || timezone}
                </Badge>

                <div className="relative z-10 my-1">
                    <div className="text-5xl font-light tracking-tighter tabular-nums text-foreground">
                        {formattedTime}
                    </div>
                </div>

                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground/80">
                    <Calendar className="h-3.5 w-3.5 opacity-70" />
                    <span>{formattedDate}</span>
                </div>
            </div>
        </div>
    );
};

export const WorldClock = WorldClockComponent;

export const WorldClockDefinition: WidgetDefinition = {
    type: 'world-clock',
    name: 'World Clock',
    description: 'Displays current time in a specific timezone.',
    icon: <Clock className="h-4 w-4" />,
    component: WorldClock,
    SettingsComponent: WorldClockSettingsComponent,
    defaultSettings: { timezone: 'UTC', showSeconds: true },
    layout: { w: 3, h: 3, minW: 2, minH: 2, maxW: 4, maxH: 4 }
};
