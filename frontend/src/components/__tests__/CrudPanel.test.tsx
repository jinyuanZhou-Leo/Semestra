// input:  [`CrudPanel`, testing-library render helpers, and shared table-row primitives]
// output: [test suite for mobile-safe CrudPanel overflow containment]
// pos:    [Regression coverage for shared settings CRUD shell sizing and scrolling wrappers]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CrudPanel } from '@/components/CrudPanel';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';

describe('CrudPanel', () => {
    it('keeps horizontal scrolling contained inside the table shell', () => {
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
    });
});
