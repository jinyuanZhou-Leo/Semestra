import React from 'react';
import { Button } from '../components/Button';
import type { WidgetDefinition, WidgetProps } from '../services/widgetRegistry';

export const Counter: React.FC<WidgetProps> = ({ settings, updateSettings }) => {
    // We can still keep local state for immediate feedback if we want super-fast response before parent updates,
    // but the parent's optimistic update should be fast enough.
    // However, keeping it controlled by props is cleaner.
    const count = settings?.value || 0;

    const updateCount = async (newCount: number) => {
        // Optimistic UI handled by parent, we just call updateSettings
        await updateSettings({ ...settings, value: newCount });
    };

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem',
            userSelect: 'none'
        }}>
            <div style={{ fontSize: '3rem', fontWeight: 700 }}>{count}</div>
            <div style={{ display: 'flex', gap: '1rem' }}>
                <Button onClick={() => updateCount(count - 1)} variant="secondary">-</Button>
                <Button onClick={() => updateCount(count + 1)}>+</Button>
            </div>
        </div>
    );
};

export const CounterDefinition: WidgetDefinition = {
    type: 'counter',
    name: 'Counter',
    description: 'A simple tally counter for tracking attendance or tasks.',
    icon: '🔢',
    component: Counter,
    defaultSettings: { value: 0 },
    defaultLayout: { w: 3, h: 4, minW: 2, minH: 2 }
};
