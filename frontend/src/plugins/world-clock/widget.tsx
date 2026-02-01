import React, { useState, useEffect } from 'react';
import { Button } from '../../components/Button';
import type { WidgetDefinition, WidgetProps, WidgetSettingsProps } from '../../services/widgetRegistry';

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
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Timezone
                </label>
                <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg-secondary)',
                        color: 'var(--color-text-primary)'
                    }}
                >
                    {AVAILABLE_TIMEZONES.map(tz => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
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

    const formattedTime = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: timezone,
        hour12: false
    }).format(time);

    const formattedDate = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: timezone
    }).format(time);

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '1rem',
            userSelect: 'none'
        }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                {timezone.split('/')[1]?.replace('_', ' ') || timezone}
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, fontFamily: 'monospace', lineHeight: 1 }}>
                {formattedTime}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)', marginTop: '0.5rem' }}>
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
