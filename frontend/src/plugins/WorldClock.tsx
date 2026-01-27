import React, { useState, useEffect } from 'react';
import type { WidgetDefinition, WidgetProps } from '../services/widgetRegistry';

const AVAILABLE_TIMEZONES = [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'New York' },
    { value: 'Europe/London', label: 'London' },
    { value: 'Asia/Tokyo', label: 'Tokyo' },
    { value: 'Australia/Sydney', label: 'Sydney' },
    { value: 'Asia/Shanghai', label: 'Shanghai' },
];

export const WorldClock: React.FC<WidgetProps> = ({ settings, updateSettings }) => {
    const [time, setTime] = useState(new Date());
    const [isEditing, setIsEditing] = useState(false);

    // Default settings if not present
    const timezone = settings?.timezone || 'UTC';

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const saveSettings = async (newTimezone: string) => {
        try {
            await updateSettings({ ...settings, timezone: newTimezone });
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to update widget settings", error);
        }
    };

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
            position: 'relative',
            userSelect: 'none'
        }}>
            <div style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                opacity: 0.5,
                cursor: 'pointer',
                zIndex: 10
            }} onClick={() => setIsEditing(!isEditing)}>
                ⚙️
            </div>

            {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                    <select
                        value={timezone}
                        onChange={(e) => saveSettings(e.target.value)}
                        style={{
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
            ) : (
                <>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                        {timezone.split('/')[1]?.replace('_', ' ') || timezone}
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, fontFamily: 'monospace', lineHeight: 1 }}>
                        {formattedTime}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)', marginTop: '0.5rem' }}>
                        {formattedDate}
                    </div>
                </>
            )}
        </div>
    );
};

export const WorldClockDefinition: WidgetDefinition = {
    type: 'world-clock',
    name: 'World Clock',
    description: 'Displays current time in a specific timezone.',
    icon: '🌍',
    component: WorldClock,
    defaultSettings: { timezone: 'UTC' },
    defaultLayout: { w: 2, h: 3, minW: 2, minH: 2 }
};
