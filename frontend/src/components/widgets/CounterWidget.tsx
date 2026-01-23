import React, { useState } from 'react';
import { Button } from '../Button';
import api from '../../services/api';

interface CounterWidgetProps {
    widgetId: string;
    settings: { value?: number };
}

export const CounterWidget: React.FC<CounterWidgetProps> = ({ widgetId, settings }) => {
    const [count, setCount] = useState(settings.value || 0);
    const [isSaving, setIsSaving] = useState(false);

    const updateCount = async (newCount: number) => {
        setCount(newCount);
        setIsSaving(true);
        try {
            await api.updateWidget(parseInt(widgetId), {
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
