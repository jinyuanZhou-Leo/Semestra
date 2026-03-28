// input:  [`DataTable`, testing-library render helpers, and shared table-row primitives]
// output: [test suite for mobile-safe DataTable overflow containment, fixed left-right header layout, optional caller-owned minimum widths, and shared fill-width plus small minimum-column defaults]
// pos:    [Regression coverage for shared settings data-table shell sizing, scrolling wrappers, header layout, and shared column-layout defaults that keep width policy with the caller instead of a forced shared minimum while still filling available width]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataTable } from '@/components/DataTable';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';

describe('DataTable', () => {
    it('keeps horizontal scrolling contained inside the table shell while applying fill-width and small minimum-column defaults', () => {
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
        expect(shell).toHaveClass('w-full', 'min-w-0', 'max-w-full', 'overflow-x-auto', 'overflow-y-hidden');
        expect(minWidthWrapper).toHaveClass('min-w-[500px]', 'sm:min-w-[560px]');
        expect(table).toHaveClass(
            'min-w-full',
            'w-full',
            'table-auto',
            '[&_td]:min-w-[6rem]',
            '[&_td]:max-w-[18rem]',
            '[&_td]:overflow-hidden',
            '[&_td]:text-ellipsis',
            '[&_td]:whitespace-nowrap',
            '[&_th]:min-w-[6rem]',
            '[&_th]:max-w-[18rem]',
            '[&_th]:overflow-hidden',
            '[&_th]:text-ellipsis',
            '[&_th]:whitespace-nowrap',
        );
    });

    it('does not force a shared minimum width when the caller does not provide one', () => {
        render(
            <DataTable
                title="Courses"
                description="Manage semester courses."
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

        const table = screen.getByRole('table');
        const minWidthWrapper = table.parentElement?.parentElement;

        expect(minWidthWrapper).toHaveClass('min-w-full');
        expect(minWidthWrapper).not.toHaveClass('min-w-[720px]');
    });

    it('keeps the title copy and action area in a left-right header layout', () => {
        render(
            <DataTable
                title="Courses"
                description="Manage semester courses."
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

        const heading = screen.getByText('Courses');
        const header = heading.parentElement?.parentElement;
        const actionWrapper = screen.getByRole('button', { name: 'Add Course' }).parentElement;

        expect(header).toHaveClass('flex', 'items-start', 'justify-between');
        expect(header).not.toHaveClass('flex-col');
        expect(actionWrapper).toHaveClass('shrink-0', 'justify-end');
        expect(actionWrapper).not.toHaveClass('w-full');
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
