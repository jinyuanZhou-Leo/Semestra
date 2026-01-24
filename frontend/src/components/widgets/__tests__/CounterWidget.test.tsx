import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CounterWidget } from '../../../plugins/CounterWidget';
import api from '../../../services/api';
import { vi, describe, it, expect } from 'vitest';

vi.mock('../../../services/api', () => ({
    default: {
        updateWidget: vi.fn().mockResolvedValue({}),
    }
}));

describe('CounterWidget', () => {
    it('renders initial value', () => {
        render(<CounterWidget widgetId="1" settings={{ value: 5 }} />);
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('increments value and calls api', async () => {
        render(<CounterWidget widgetId="1" settings={{ value: 5 }} />);
        const incrementBtn = screen.getByText('+');
        fireEvent.click(incrementBtn);

        await waitFor(() => {
            expect(screen.getByText('6')).toBeInTheDocument();
        });

        expect(api.updateWidget).toHaveBeenCalledWith("1", expect.objectContaining({
            settings: JSON.stringify({ value: 6 })
        }));
    });

    it('decrements value', async () => {
        render(<CounterWidget widgetId="1" settings={{ value: 5 }} />);
        const decrementBtn = screen.getByText('-');
        fireEvent.click(decrementBtn);

        await waitFor(() => {
            expect(screen.getByText('4')).toBeInTheDocument();
        });
    });
});
