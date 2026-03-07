// input:  [Counter widget component, testing-library render/fireEvent helpers, and Vitest mocks]
// output: [test suite validating counter increment/decrement updates and invalid-range clamping]
// pos:    [Widget unit tests for counter runtime behavior and safe range normalization]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen } from '@testing-library/react';
import { Counter } from '../../../plugins/counter/widget';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('CounterWidget', () => {
    const mockUpdateSettings = vi.fn().mockResolvedValue(undefined);

    afterEach(() => {
        mockUpdateSettings.mockClear();
    });

    it('renders initial value', () => {
        render(<Counter widgetId="1" settings={{ value: 5 }} updateSettings={mockUpdateSettings} />);
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('increments value and calls updateSettings', async () => {
        render(<Counter widgetId="1" settings={{ value: 5 }} updateSettings={mockUpdateSettings} />);
        const incrementBtn = screen.getByLabelText('Increment');
        fireEvent.click(incrementBtn);

        expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ value: 6 }));
    });

    it('decrements value', async () => {
        render(<Counter widgetId="1" settings={{ value: 5 }} updateSettings={mockUpdateSettings} />);
        const decrementBtn = screen.getByLabelText('Decrement');
        fireEvent.click(decrementBtn);

        expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ value: 4 }));
    });

    it('clamps invalid ranges into a safe display state', () => {
        render(
            <Counter
                widgetId="1"
                settings={{ value: 20, min: 5, max: 5, initialValue: 50, step: 1 }}
                updateSettings={mockUpdateSettings}
            />
        );

        expect(screen.getByText('6')).toBeInTheDocument();
        expect(screen.getByLabelText('Increment')).toBeDisabled();
        expect(screen.getByLabelText('Decrement')).not.toBeDisabled();
    });
});
