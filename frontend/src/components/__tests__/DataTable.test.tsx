// input:  [`DataTable`, testing-library render/user-event helpers, and shared table-row primitives]
// output: [test suite covering render-props layout, columns-API rendering, client-side sorting,
//          built-in pagination, declarative column widths, and empty/loading states]
// pos:    [Regression coverage for the shared settings data-table shell. Validates both the legacy
//          render-props path (for backwards compatibility) and the new columns API (sorting,
//          fixed/auto layout, colgroup widths, alignment, custom cell renderers, and row keys).]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { DataTable } from '@/components/DataTable';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';


// ─── Shared fixtures ──────────────────────────────────────────────────────────

interface Course {
    id: string;
    name: string;
    credits: number;
    grade: string;
}

const COURSES: Course[] = [
    { id: 'c1', name: 'Algorithms',   credits: 3, grade: 'A' },
    { id: 'c2', name: 'Databases',    credits: 4, grade: 'B' },
    { id: 'c3', name: 'Compilers',    credits: 3, grade: 'A+' },
];

const BASE_PROPS = {
    title: 'Courses',
    description: 'Manage semester courses.',
};


// ─── Render-props (legacy) ────────────────────────────────────────────────────

describe('DataTable — render-props (legacy path)', () => {
    it('keeps horizontal scrolling contained inside the table shell while applying fill-width and small minimum-column defaults', () => {
        const { container } = render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                minWidthClassName="min-w-[500px] sm:min-w-[560px]"
                renderHeader={() => (
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                )}
                renderRow={(item: Course) => (
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
            'min-w-full', 'w-full', 'table-auto',
            '[&_td]:min-w-[6rem]', '[&_td]:max-w-[18rem]',
            '[&_td]:overflow-hidden', '[&_td]:text-ellipsis', '[&_td]:whitespace-nowrap',
            '[&_th]:min-w-[6rem]', '[&_th]:max-w-[18rem]',
            '[&_th]:overflow-hidden', '[&_th]:text-ellipsis', '[&_th]:whitespace-nowrap',
        );
    });

    it('does not force a shared minimum width when the caller does not provide one', () => {
        render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                renderHeader={() => <TableRow><TableHead>Name</TableHead></TableRow>}
                renderRow={(item: Course) => <TableRow key={item.id}><TableCell>{item.name}</TableCell></TableRow>}
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
                {...BASE_PROPS}
                actionButton={<button type="button">Add Course</button>}
                items={COURSES}
                renderHeader={() => <TableRow><TableHead>Name</TableHead></TableRow>}
                renderRow={(item: Course) => <TableRow key={item.id}><TableCell>{item.name}</TableCell></TableRow>}
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
                {...BASE_PROPS}
                showHeader={false}
                actionButton={<button type="button">Add Course</button>}
                items={COURSES}
                renderHeader={() => <TableRow><TableHead>Name</TableHead></TableRow>}
                renderRow={(item: Course) => <TableRow key={item.id}><TableCell>{item.name}</TableCell></TableRow>}
            />,
        );

        expect(screen.queryByText('Manage semester courses.')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add Course' })).toBeInTheDocument();
    });
});


// ─── Columns API — rendering ──────────────────────────────────────────────────

describe('DataTable — columns API rendering', () => {
    it('renders all column headers and cell values from item fields', () => {
        render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                getRowKey={(c) => c.id}
                columns={[
                    { key: 'name',    label: 'Name'    },
                    { key: 'credits', label: 'Credits' },
                    { key: 'grade',   label: 'Grade'   },
                ]}
            />,
        );

        expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Credits' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Grade' })).toBeInTheDocument();

        // Every row's data appears in the table.
        for (const course of COURSES) {
            expect(screen.getByText(course.name)).toBeInTheDocument();
        }
        // credits values (may repeat across rows — use getAllByText)
        for (const course of COURSES) {
            expect(screen.getAllByText(String(course.credits)).length).toBeGreaterThan(0);
        }
    });

    it('renders default text cells with truncate-friendly overflow handling', () => {
        render(
            <DataTable
                {...BASE_PROPS}
                items={[{ ...COURSES[0], name: 'A very long course name that should truncate cleanly' }]}
                getRowKey={(c) => c.id}
                columns={[
                    { key: 'name', label: 'Name', width: 120 },
                ]}
            />,
        );

        const text = screen.getByText('A very long course name that should truncate cleanly');
        expect(text).toHaveClass('block', 'min-w-0', 'truncate');
        expect(text).toHaveAttribute('title', 'A very long course name that should truncate cleanly');
    });

    it('renders custom cell content when a cell renderer is provided', () => {
        render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                getRowKey={(c) => c.id}
                columns={[
                    { key: 'name', label: 'Name' },
                    {
                        key: 'grade',
                        label: 'Grade',
                        cell: (item) => <span data-testid={`badge-${item.id}`}>{item.grade}</span>,
                    },
                ]}
            />,
        );

        for (const course of COURSES) {
            expect(screen.getByTestId(`badge-${course.id}`)).toHaveTextContent(course.grade);
        }
    });

    it('wraps custom cell content in an overflow-hidden container', () => {
        render(
            <DataTable
                {...BASE_PROPS}
                items={[COURSES[0]]}
                getRowKey={(c) => c.id}
                columns={[
                    {
                        key: 'grade',
                        label: 'Grade',
                        width: 80,
                        cell: (item) => <div data-testid={`custom-${item.id}`}>Custom UI content</div>,
                    },
                ]}
            />,
        );

        const custom = screen.getByTestId('custom-c1');
        expect(custom.parentElement).toHaveClass('min-w-0', 'overflow-hidden');
        expect(custom.closest('td')).toHaveClass('overflow-hidden');
    });

    it('renders text returned from a custom cell with ellipsis handling', () => {
        render(
            <DataTable
                {...BASE_PROPS}
                items={[COURSES[0]]}
                getRowKey={(c) => c.id}
                columns={[
                    {
                        key: 'grade',
                        label: 'Grade',
                        width: 80,
                        cell: () => 'A very long grade description',
                    },
                ]}
            />,
        );

        const text = screen.getByText('A very long grade description');
        expect(text).toHaveClass('block', 'min-w-0', 'truncate');
        expect(text).toHaveAttribute('title', 'A very long grade description');
    });

    it('applies per-column text alignment to headers and cells', () => {
        const { container } = render(
            <DataTable
                {...BASE_PROPS}
                items={[COURSES[0]]}
                getRowKey={(c) => c.id}
                columns={[
                    { key: 'name',    label: 'Name',    align: 'left'   },
                    { key: 'credits', label: 'Credits', align: 'center' },
                    { key: 'grade',   label: 'Grade',   align: 'right'  },
                ]}
            />,
        );

        const headers = container.querySelectorAll('th');
        expect(headers[0]).toHaveClass('text-left');
        expect(headers[1]).toHaveClass('text-center');
        expect(headers[2]).toHaveClass('text-right');

        const cells = container.querySelectorAll('tbody td');
        expect(cells[0]).toHaveClass('text-left');
        expect(cells[1]).toHaveClass('text-center');
        expect(cells[2]).toHaveClass('text-right');
    });
});


// ─── Columns API — layout & widths ────────────────────────────────────────────

describe('DataTable — columns API layout', () => {
    it('uses table-auto and no colgroup when no column declares width or fit', () => {
        const { container } = render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                columns={[
                    { key: 'name',  label: 'Name'  },
                    { key: 'grade', label: 'Grade' },
                ]}
            />,
        );

        const table = screen.getByRole('table');
        expect(table).toHaveClass('table-auto');
        expect(table).not.toHaveClass('table-fixed');
        expect(container.querySelector('colgroup')).toBeNull();
    });

    it('switches to table-fixed and renders colgroup when any column declares a width', () => {
        const { container } = render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                columns={[
                    { key: 'name',    label: 'Name',    fit: 'fill' },
                    { key: 'credits', label: 'Credits', width: 90   },
                    { key: 'grade',   label: 'Grade',   width: 80   },
                ]}
            />,
        );

        const table = screen.getByRole('table');
        expect(table).toHaveClass('table-fixed');
        expect(table).not.toHaveClass('table-auto');

        const colgroup = container.querySelector('colgroup');
        expect(colgroup).not.toBeNull();

        const cols = colgroup!.querySelectorAll('col');
        expect(cols).toHaveLength(3);

        // fit:'fill' column — width style should be empty / absent
        expect((cols[0] as HTMLElement).style.width).toBeFalsy();

        // Fixed-width columns — width normalised to px string
        expect(cols[1]).toHaveStyle({ width: '90px' });
        expect(cols[2]).toHaveStyle({ width: '80px' });
    });

    it('switches to table-fixed when only fit columns are declared (no explicit widths)', () => {
        const { container } = render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                columns={[
                    { key: 'name',  label: 'Name',  fit: 'fill' },
                    { key: 'grade', label: 'Grade', fit: 'fill' },
                ]}
            />,
        );

        expect(screen.getByRole('table')).toHaveClass('table-fixed');
        expect(container.querySelector('colgroup')).not.toBeNull();
    });

    it('applies minWidth style to col elements when specified', () => {
        const { container } = render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                columns={[
                    { key: 'name',    label: 'Name',    fit: 'fill', minWidth: 120 },
                    { key: 'credits', label: 'Credits', width: 90 },
                ]}
            />,
        );

        const cols = container.querySelectorAll('colgroup col');
        expect((cols[0] as HTMLElement).style.minWidth).toBe('120px');
        expect((cols[1] as HTMLElement).style.minWidth).toBeFalsy();
    });

    it('accepts string widths (e.g. percentages) and passes them through verbatim', () => {
        const { container } = render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                columns={[
                    { key: 'name',    label: 'Name',    width: '60%' },
                    { key: 'credits', label: 'Credits', width: '40%' },
                ]}
            />,
        );

        const cols = container.querySelectorAll('colgroup col');
        expect(cols[0]).toHaveStyle({ width: '60%' });
        expect(cols[1]).toHaveStyle({ width: '40%' });
    });
});


// ─── Columns API — sorting ────────────────────────────────────────────────────

describe('DataTable — columns API sorting', () => {
    it('renders a sort icon only on sortable column headers', () => {
        render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                columns={[
                    { key: 'name',    label: 'Name',    sortable: true },
                    { key: 'credits', label: 'Credits'                 },
                ]}
            />,
        );

        // Sortable header is a button-like clickable element (cursor-pointer class).
        const nameHeader = screen.getByRole('columnheader', { name: /Name/i });
        expect(nameHeader).toHaveClass('cursor-pointer');

        const creditsHeader = screen.getByRole('columnheader', { name: 'Credits' });
        expect(creditsHeader).not.toHaveClass('cursor-pointer');
    });

    it('sorts string column ascending on first click then descending on second click', () => {
        render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                getRowKey={(c) => c.id}
                columns={[
                    { key: 'name', label: 'Name', sortable: true },
                ]}
            />,
        );

        const nameHeader = screen.getByRole('columnheader', { name: /Name/i });

        // Initial order: Algorithms, Databases, Compilers
        let cells = screen.getAllByRole('cell');
        expect(cells[0]).toHaveTextContent('Algorithms');

        // First click → ascending (A → Z): Algorithms, Compilers, Databases
        fireEvent.click(nameHeader);
        cells = screen.getAllByRole('cell');
        expect(cells[0]).toHaveTextContent('Algorithms');
        expect(cells[1]).toHaveTextContent('Compilers');
        expect(cells[2]).toHaveTextContent('Databases');

        // Second click → descending (Z → A): Databases, Compilers, Algorithms
        fireEvent.click(nameHeader);
        cells = screen.getAllByRole('cell');
        expect(cells[0]).toHaveTextContent('Databases');
        expect(cells[1]).toHaveTextContent('Compilers');
        expect(cells[2]).toHaveTextContent('Algorithms');

        // Third click → reset to original order
        fireEvent.click(nameHeader);
        cells = screen.getAllByRole('cell');
        expect(cells[0]).toHaveTextContent('Algorithms');
    });

    it('sorts numeric columns correctly', () => {
        render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                getRowKey={(c) => c.id}
                columns={[
                    { key: 'credits', label: 'Credits', sortable: true },
                ]}
            />,
        );

        fireEvent.click(screen.getByRole('columnheader', { name: /Credits/i }));

        // Ascending: 3, 3, 4  (Algorithms/Compilers=3 then Databases=4)
        const cells = screen.getAllByRole('cell');
        const values = cells.map((c) => Number(c.textContent));
        expect(values).toEqual([...values].sort((a, b) => a - b));
    });

    it('uses a custom comparator when sortable is a function', () => {
        // Sort by grade string length as a custom comparator test
        render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                getRowKey={(c) => c.id}
                columns={[
                    {
                        key: 'grade',
                        label: 'Grade',
                        sortable: (a: Course, b: Course) =>
                            a.grade.length - b.grade.length,
                    },
                ]}
            />,
        );

        fireEvent.click(screen.getByRole('columnheader', { name: /Grade/i }));

        // A+ (len 2) should sort after A and B (len 1) in ascending order
        const cells = screen.getAllByRole('cell');
        expect(cells[2]).toHaveTextContent('A+');
    });

    it('resets sort state when a different column header is clicked', () => {
        render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                getRowKey={(c) => c.id}
                columns={[
                    { key: 'name',    label: 'Name',    sortable: true },
                    { key: 'credits', label: 'Credits', sortable: true },
                ]}
            />,
        );

        // Sort by name ascending then switch to credits — sort key should reset to credits
        fireEvent.click(screen.getByRole('columnheader', { name: /Name/i }));
        fireEvent.click(screen.getByRole('columnheader', { name: /Credits/i }));

        // 2 columns × 3 rows = 6 cells; credits are at indices 1, 3, 5
        // Ascending credits: last credits cell should be 4 (Databases)
        let cells = screen.getAllByRole('cell');
        expect(cells[5]).toHaveTextContent('4');

        // Regression: second click on credits → descending; first credits cell should now be 4
        fireEvent.click(screen.getByRole('columnheader', { name: /Credits/i }));
        cells = screen.getAllByRole('cell');
        expect(cells[1]).toHaveTextContent('4');
    });
});


// ─── Built-in pagination ──────────────────────────────────────────────────────

describe('DataTable — built-in pagination', () => {
    it('uses the default page size when pagination is enabled without an explicit pageSize', () => {
        render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                getRowKey={(c) => c.id}
                columns={[
                    { key: 'name', label: 'Name' },
                ]}
                pagination={{ itemLabel: 'courses' }}
            />,
        );

        expect(screen.getByText('Showing 1-3 of 3 courses')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: '2' })).not.toBeInTheDocument();
    });

    it('renders the shadcn pagination footer below the table and paginates rows client-side', () => {
        render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                getRowKey={(c) => c.id}
                columns={[
                    { key: 'name', label: 'Name' },
                ]}
                pagination={{ pageSize: 2, itemLabel: 'courses' }}
            />,
        );

        expect(screen.getByText('Showing 1-2 of 3 courses')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Go to previous page' })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByText('Algorithms')).toBeInTheDocument();
        expect(screen.getByText('Databases')).toBeInTheDocument();
        expect(screen.queryByText('Compilers')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('link', { name: '2' }));

        expect(screen.getByText('Showing 3-3 of 3 courses')).toBeInTheDocument();
        expect(screen.getByText('Compilers')).toBeInTheDocument();
        expect(screen.queryByText('Algorithms')).not.toBeInTheDocument();
    });

    it('resets pagination back to the first page after sorting changes the visible order', () => {
        render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                getRowKey={(c) => c.id}
                columns={[
                    { key: 'name', label: 'Name', sortable: true },
                ]}
                pagination={{ pageSize: 2, itemLabel: 'courses' }}
            />,
        );

        fireEvent.click(screen.getByRole('link', { name: '2' }));
        expect(screen.getByText('Compilers')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('columnheader', { name: /Name/i }));

        expect(screen.getByText('Showing 1-2 of 3 courses')).toBeInTheDocument();
        expect(screen.getByText('Algorithms')).toBeInTheDocument();
        expect(screen.getByText('Compilers')).toBeInTheDocument();
        expect(screen.queryByText('Databases')).not.toBeInTheDocument();
    });

    it('passes absolute row indexes to cell renderers across paginated pages', () => {
        const { container } = render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                getRowKey={(c) => c.id}
                columns={[
                    {
                        key: 'index',
                        label: '#',
                        cell: (_item, index) => <span>{index}</span>,
                    },
                    { key: 'name', label: 'Name' },
                ]}
                pagination={{ pageSize: 2, itemLabel: 'courses' }}
            />,
        );

        const body = container.querySelector('tbody');
        expect(body).not.toBeNull();
        expect(body).toHaveTextContent('0');
        expect(body).toHaveTextContent('1');

        fireEvent.click(screen.getByRole('link', { name: '2' }));

        expect(body).toHaveTextContent('2');
        expect(body).not.toHaveTextContent('0');
    });

    it('keeps the current page when the parent rebuilds the items array without changing the data', () => {
        function StableItemsWrapper() {
            const [version, setVersion] = useState(0);
            const items = COURSES.map((course) => ({ ...course }));

            return (
                <>
                    <button type="button" onClick={() => setVersion((value) => value + 1)}>
                        Refresh
                    </button>
                    <span>{version}</span>
                    <DataTable
                        {...BASE_PROPS}
                        items={items}
                        getRowKey={(c) => c.id}
                        columns={[{ key: 'name', label: 'Name' }]}
                        pagination={{ pageSize: 2, itemLabel: 'courses' }}
                    />
                </>
            );
        }

        render(<StableItemsWrapper />);

        fireEvent.click(screen.getByRole('link', { name: '2' }));
        expect(screen.getByText(/Showing\s+3-3\s+of\s+3\s+courses/)).toBeInTheDocument();
        expect(screen.getByText('Compilers')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

        expect(screen.getByText(/Showing\s+3-3\s+of\s+3\s+courses/)).toBeInTheDocument();
        expect(screen.getByText('Compilers')).toBeInTheDocument();
        expect(screen.queryByText('Algorithms')).not.toBeInTheDocument();
    });

    it('bounds the scrollable table area height while keeping pagination outside that region', () => {
        const { container } = render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                getRowKey={(c) => c.id}
                columns={[
                    { key: 'name', label: 'Name' },
                ]}
                maxBodyHeight={240}
                pagination={{ pageSize: 2, itemLabel: 'courses' }}
            />,
        );

        const scrollArea = container.querySelector('[data-slot="data-table-scroll-area"]');
        expect(scrollArea).toHaveClass('overflow-y-auto');
        expect(scrollArea).toHaveStyle({ maxHeight: '240px' });
        expect(scrollArea).toContainElement(screen.getByRole('table'));
        expect(scrollArea).not.toContainElement(screen.getByText('Showing 1-2 of 3 courses'));
    });

    it('supports a fixed scrollable table height', () => {
        const { container } = render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                getRowKey={(c) => c.id}
                columns={[
                    { key: 'name', label: 'Name' },
                ]}
                bodyHeight={320}
                pagination={{ pageSize: 2, itemLabel: 'courses' }}
            />,
        );

        const scrollArea = container.querySelector('[data-slot="data-table-scroll-area"]');
        expect(scrollArea).toHaveClass('overflow-y-auto');
        expect(scrollArea).toHaveStyle({ height: '320px' });
        expect(scrollArea).not.toHaveStyle({ maxHeight: '320px' });
    });
});


// ─── Empty & loading states ───────────────────────────────────────────────────

describe('DataTable — empty and loading states', () => {
    it('shows the custom empty message when items is empty', () => {
        render(
            <DataTable
                {...BASE_PROPS}
                items={[]}
                emptyMessage="No courses assigned yet."
                columns={[{ key: 'name', label: 'Name' }]}
            />,
        );

        expect(screen.getByText('No courses assigned yet.')).toBeInTheDocument();
    });

    it('shows a loading spinner and hides rows while isLoading is true', () => {
        render(
            <DataTable
                {...BASE_PROPS}
                items={COURSES}
                isLoading
                columns={[{ key: 'name', label: 'Name' }]}
            />,
        );

        // None of the course names should be visible during loading
        for (const course of COURSES) {
            expect(screen.queryByText(course.name)).not.toBeInTheDocument();
        }
    });
});
