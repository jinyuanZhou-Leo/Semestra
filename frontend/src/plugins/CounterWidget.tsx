import React, { useState } from 'react';
import { Button } from '../components/Button';
import api from '../services/api';
import type { WidgetDefinition, WidgetProps } from '../services/widgetRegistry';

export const CounterWidget: React.FC<WidgetProps> = ({ widgetId, settings }) => {
    const [count, setCount] = useState(settings?.value || 0);
    const [isSaving, setIsSaving] = useState(false);

    const updateCount = async (newCount: number) => {
        setCount(newCount);
        setIsSaving(true);
        try {
            await api.updateWidget(widgetId, {
                settings: JSON.stringify({ ...settings, value: newCount })
            });
        } catch (error) {
            console.error("Failed to save counter", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem'
        }}>
            <div style={{ fontSize: '3rem', fontWeight: 700 }}>{count}</div>
            <div style={{ display: 'flex', gap: '1rem' }}>
                <Button onClick={() => updateCount(count - 1)} variant="secondary">-</Button>
                <Button onClick={() => updateCount(count + 1)}>+</Button>
            </div>
            {isSaving && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>Saving...</div>}
        </div>
    );
};

export const CounterWidgetDefinition: WidgetDefinition = {
    type: 'counter',
    name: 'Counter',
    description: 'A simple tally counter for tracking attendance or tasks.',
    icon: '🔢',
    component: CounterWidget,
    defaultSettings: { value: 0 },
    defaultLayout: { w: 3, h: 4, minW: 2, minH: 2 }
};
