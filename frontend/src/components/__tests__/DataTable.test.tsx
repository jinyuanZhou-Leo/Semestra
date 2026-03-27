// input:  [`DataTable`, testing-library render helpers, and shared table-row primitives]
// output: [test suite for mobile-safe DataTable overflow containment, fit-content column sizing, and shared single-line ellipsis defaults]
// pos:    [Regression coverage for shared settings data-table shell sizing, scrolling wrappers, and shared column-layout defaults that keep columns content-driven until the shared ellipsis cap]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataTable } from '@/components/DataTable';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';

describe('DataTable', () => {
    it('keeps horizontal scrolling contained inside the table shell while capping cells with single-line ellipsis defaults', () => {
        const { container } = render(
            <DataTable
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
        expect(table).toHaveClass(
            'min-w-full',
            'w-max',
            'table-auto',
            '[&_td]:max-w-[18rem]',
            '[&_td]:overflow-hidden',
            '[&_td]:text-ellipsis',
            '[&_td]:whitespace-nowrap',
            '[&_th]:max-w-[18rem]',
            '[&_th]:overflow-hidden',
            '[&_th]:text-ellipsis',
            '[&_th]:whitespace-nowrap',
        );
    });

    it('can hide the duplicate panel header when embedded in a parent settings section', () => {
        render(
            <DataTable
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
