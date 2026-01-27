import React, { useCallback } from 'react';
import { Button } from '../components/Button';
import type { WidgetDefinition, WidgetProps } from '../services/widgetRegistry';

/**
 * Counter Plugin - Memoized for performance
 * Optimistic UI: Local state update happens immediately via parent's optimistic update pattern
 */
const CounterComponent: React.FC<WidgetProps> = ({ settings, updateSettings }) => {
    const count = settings?.value || 0;

    // Memoize updateCount to prevent recreating on each render
    const updateCount = useCallback(async (newCount: number) => {
    // Optimistic UI is handled by parent (useDashboardWidgets hook)
    // Parent updates local state immediately, then syncs to API
        await updateSettings({ ...settings, value: newCount });
    }, [settings, updateSettings]);

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

// Memoize to prevent re-renders when parent updates unrelated state
export const Counter = React.memo(CounterComponent);

export const CounterDefinition: WidgetDefinition = {
    type: 'counter',
    name: 'Counter',
    description: 'A simple tally counter for tracking attendance or tasks.',
    icon: '🔢',
    component: Counter,
    defaultSettings: { value: 0 },
    defaultLayout: { w: 3, h: 4, minW: 2, minH: 2 }
};
