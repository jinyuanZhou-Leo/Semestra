// input:  [`AppEmptyState`, testing-library render helpers, and Vitest matchers]
// output: [test suite for business empty-state rendering and surface variants]
// pos:    [Regression coverage for shared application empty-state composition]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppEmptyState } from '@/components/AppEmptyState';

describe('AppEmptyState', () => {
    it('renders scenario copy and action content', () => {
        render(
            <AppEmptyState
                scenario="create"
                size="section"
                title="No projects yet"
                description="Create a project to get started."
                primaryAction={<button type="button">Create Project</button>}
            />,
        );

        expect(screen.getByText('No projects yet')).toBeInTheDocument();
        expect(screen.getByText('Create a project to get started.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create Project' })).toBeInTheDocument();
    });

    it('supports inherit surface for parent-owned shells', () => {
        const { container } = render(
            <AppEmptyState
                scenario="no-results"
                size="section"
                surface="inherit"
                title="No matches"
                description="Try clearing the search."
            />,
        );

        expect(container.firstChild).toHaveClass('border-0', 'bg-transparent');
    });
});
