// input:  [`GPAScalingTable`, testing-library render helpers, and Vitest matchers]
// output: [test suite for GPA scaling table empty-state rendering]
// pos:    [Regression coverage for GPA scaling table create-empty presentation]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GPAScalingTable } from '@/components/GPAScalingTable';

describe('GPAScalingTable', () => {
    it('renders the shared empty state when no rules are defined', () => {
        render(<GPAScalingTable value="{}" onChange={vi.fn()} />);

        expect(screen.getByText('No scaling rules defined')).toBeInTheDocument();
        expect(screen.getByText('Add a rule below to get started.')).toBeInTheDocument();
    });
});
