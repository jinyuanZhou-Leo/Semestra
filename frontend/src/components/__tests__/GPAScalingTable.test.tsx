// input:  [`GPAScalingTable`, testing-library render helpers, and Vitest matchers]
// output: [test suite for GPA scaling table empty-state, coverage-warning, and delete-confirmation rendering]
// pos:    [Regression coverage for GPA scaling table create-empty presentation, decimal-gap detection, and AlertDialog-backed delete confirmation]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GPAScalingTable } from '@/components/GPAScalingTable';

describe('GPAScalingTable', () => {
    it('renders the shared empty state when no rules are defined', () => {
        render(<GPAScalingTable value="{}" onChange={vi.fn()} />);

        expect(screen.getByText('No scaling rules defined.')).toBeInTheDocument();
        expect(screen.getByText('This table is empty right now.')).toBeInTheDocument();
    });

    it('warns when a decimal gap exists between configured rules', () => {
        render(<GPAScalingTable value='{"90.5-100":4,"0-90.4":3}' onChange={vi.fn()} />);

        expect(
            screen.getByText('This table does not cover the full 0–100% range. Some grades might not map correctly.'),
        ).toBeInTheDocument();
    });

    it('requires confirmation before deleting a rule', async () => {
        const onChange = vi.fn();

        render(<GPAScalingTable value='{"90-100":4,"80-89":3.7}' onChange={onChange} />);

        fireEvent.pointerDown(screen.getByRole('button', { name: 'Actions for 80–89' }));
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete rule' }));

        expect(screen.getByText('Delete scaling rule?')).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Delete rule' }));

        expect(onChange).toHaveBeenCalledWith('{"90-100":4}');
    });
});
