// input:  [Counter widget component, testing-library render/fireEvent helpers, Vitest mocks]
// output: [test suite validating counter increment/decrement updateSettings calls]
// pos:    [Widget unit tests for counter setting update behavior]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

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
});
