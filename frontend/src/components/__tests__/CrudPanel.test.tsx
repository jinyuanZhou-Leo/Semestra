// input:  [`CrudPanel`, testing-library render helpers, and shared table-row primitives]
// output: [test suite for mobile-safe CrudPanel overflow containment, responsive fixed-column layout, and default cell wrapping]
// pos:    [Regression coverage for shared settings CRUD shell sizing, scrolling wrappers, shared column-layout defaults, and non-overflowing text behavior]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CrudPanel } from '@/components/CrudPanel';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';

describe('CrudPanel', () => {
    it('keeps horizontal scrolling contained inside the table shell and uses responsive fixed column sizing', () => {
        const { container } = render(
            <CrudPanel
                title="Courses"
                description="Manage semester courses."
                items={[{ id: 'course-1', name: 'Course 1' }]}
                minWidthClassName="min-w-[500px] sm:min-w-[560px]"
                renderHeader={() => (
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                )}
                renderRow={(item: { id: string; name: string }) => (
                    <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right">Open</TableCell>
                    </TableRow>
                )}
            />,
        );

        const table = screen.getByRole('table');
        const tableContainer = table.parentElement;
        const minWidthWrapper = tableContainer?.parentElement;
        const shell = minWidthWrapper?.parentElement;
        const root = container.firstElementChild;

        expect(root).toHaveClass('w-full', 'min-w-0');
        expect(shell).toHaveClass('w-full', 'min-w-0', 'max-w-full', 'overflow-x-auto');
        expect(minWidthWrapper).toHaveClass('min-w-[500px]', 'sm:min-w-[560px]');
        expect(table).toHaveClass('table-fixed');
        expect(root).toHaveClass('[&_[data-slot=table-cell]]:whitespace-normal', '[&_[data-slot=table-cell]]:break-words');
        expect(root).toHaveClass('[&_[data-slot=table-head]]:whitespace-normal', '[&_[data-slot=table-head]]:break-words');
    });

    it('can hide the duplicate panel header when embedded in a parent settings section', () => {
        render(
            <CrudPanel
                title="Courses"
                description="Manage semester courses."
                showHeader={false}
                actionButton={<button type="button">Add Course</button>}
                items={[{ id: 'course-1', name: 'Course 1' }]}
                renderHeader={() => (
                    <TableRow>
                        <TableHead>Name</TableHead>
                    </TableRow>
                )}
                renderRow={(item: { id: string; name: string }) => (
                    <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                    </TableRow>
                )}
            />,
        );

        expect(screen.queryByText('Manage semester courses.')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add Course' })).toBeInTheDocument();
    });
});
