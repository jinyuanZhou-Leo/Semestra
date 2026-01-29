import { render, screen, fireEvent } from '@testing-library/react';
import { Counter } from '../../../plugins/counter';
import { vi, describe, it, expect } from 'vitest';

describe('CounterWidget', () => {
    const mockUpdateSettings = vi.fn().mockResolvedValue(undefined);

    it('renders initial value', () => {
        render(<Counter widgetId="1" settings={{ value: 5 }} updateSettings={mockUpdateSettings} />);
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('increments value and calls updateSettings', async () => {
        render(<Counter widgetId="1" settings={{ value: 5 }} updateSettings={mockUpdateSettings} />);
        const incrementBtn = screen.getByText('+');
        fireEvent.click(incrementBtn);

        // Optimistic update might not happen in the component anymore as it relies on props change?
        // Wait, in my implementation of CounterWidget:
        // const updateCount = async (newCount: number) => { await updateSettings({ ...settings, value: newCount }); };
        // It DOES NOT update local state 'count' anymore. 'count' comes from props 'settings'.
        // So the test 'expect(screen.getByText('6')).toBeInTheDocument()' WILL FAIL unless I re-render with new props,
        // or if the test setup handles it.
        // But here I'm testing the component in isolation.
        // So I should only check if updateSettings is called.

        expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ value: 6 }));
    });

    it('decrements value', async () => {
        render(<Counter widgetId="1" settings={{ value: 5 }} updateSettings={mockUpdateSettings} />);
        const decrementBtn = screen.getByText('-');
        fireEvent.click(decrementBtn);

        expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ value: 4 }));
    });
});
