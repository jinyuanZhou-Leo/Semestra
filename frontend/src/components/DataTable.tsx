// input:  [column definitions OR render-prop callbacks, items array, optional loading/action controls,
//          optional panel header copy, optional per-surface minimum table widths, optional root/shell/
//          table/empty-row class overrides, shared dropdown row-action composition, and shared business
//          empty-state styling]
// output: [`DataTable`, `DataTableActionMenu`, `TableShell`, `PanelHeader`, and `EmptyTableRow`
//          helpers for settings data tables]
// pos:    [Shared settings-table shell that keeps header actions and horizontal scrolling mobile-safe
//          across settings data tables. Supports two authoring styles:
//            1. columns API  — declare column shape, width, alignment, sorting, and cell renderers as
//               a plain array; the component owns all <thead>/<tbody> boilerplate. Preferred because it
//               is strongly typed, concise, and consistent across every usage site.
//            2. render-props — escape hatch for exotic column heads (e.g. a bulk-toggle Switch in the
//               header) that cannot be expressed through ColumnDef. Falls back automatically when
//               `columns` is omitted.
//          Sorting is purely client-side (none → asc → desc → none cycle) and requires zero extra state
//          at the call site. Column widths can be fixed or fill-based via colgroup so LLM-generated
//          tables stay visually consistent without ad-hoc Tailwind width classes.]
//
// ─── COLUMN API QUICK REFERENCE ────────────────────────────────────────────────
//
//   Basic usage (columns array, no extra state needed):
//
//     <DataTable
//       title="Courses"
//       description="Courses in this semester."
//       items={courses}
//       getRowKey={(c) => c.id}
//       columns={[
//         { key: 'name',    label: 'Name',    fit: 'fill', sortable: true },
//         { key: 'credits', label: 'Credits', width: 90,   sortable: true },
//         { key: 'grade',   label: 'Grade',   width: 90 },
//         { key: 'actions', label: 'Actions', width: 64,   align: 'right',
//           cell: (course) => <DataTableActionMenu>…</DataTableActionMenu> },
//       ]}
//     />
//
//   Custom cell renderer:
//     { key: 'status', label: 'Status', cell: (item) => <Badge>{item.status}</Badge> }
//
//   Custom sort comparator (overrides the default string/number logic):
//     { key: 'due', label: 'Due', sortable: (a, b) => a.dueDate.getTime() - b.dueDate.getTime() }
//
// ─── COLUMN WIDTH REFERENCE ────────────────────────────────────────────────────
//
//   width?: number | string
//     Fixed column width. A number is treated as pixels (90 → "90px"); a string is passed
//     through verbatim ("20%", "8rem"). Triggers table-layout:fixed + <colgroup>.
//
//   fit?: 'fill'
//     Column expands to absorb all leftover table width. When several columns share fit:'fill'
//     they divide the remaining space equally. Triggers table-layout:fixed + <colgroup>.
//
//   minWidth?: number
//     Minimum px width (guards against over-squeezing fill columns on narrow viewports).
//     Only meaningful when width or fit is set.
//
//   (no width / no fit)
//     Falls back to table-layout:auto natural sizing — browser measures content and distributes
//     available width. Default <td>/<th> min/max-width guards still apply.
//
//   Tip — mixing fixed and fill:
//     Give action/badge/narrow columns a fixed width and the main content column fit:'fill'.
//     The fill column absorbs whatever the fixed columns leave over.
//
//       { key: 'name',    fit: 'fill'  }   ← grows to fill
//       { key: 'credits', width: 90    }   ← fixed 90 px
//       { key: 'actions', width: 64    }   ← fixed 64 px
//
// ─── SORTING REFERENCE ─────────────────────────────────────────────────────────
//
//   sortable: true
//     Enables client-side sorting with a default comparator:
//       string  → localeCompare
//       number  → a − b
//       other   → String(a).localeCompare(String(b))
//
//   sortable: (a, b) => number
//     Custom comparator — same contract as the callback passed to Array.prototype.sort.
//     Return a negative value, 0, or a positive value.
//
//   Click cycle:  none  →  asc  →  desc  →  none
//   Sorting resets when a different column header is clicked.
//
// ─── RENDER-PROPS FALLBACK ─────────────────────────────────────────────────────
//
//   Use when the column header itself must render an interactive element
//   (e.g. a bulk-enable Switch) that ColumnDef cannot express.
//
//     <DataTable
//       …
//       renderHeader={() => (
//         <TableRow>
//           <TableHead>Plugin</TableHead>
//           <TableHead className="text-right">
//             <Switch … />
//           </TableHead>
//         </TableRow>
//       )}
//       renderRow={(plugin) => (
//         <TableRow key={plugin.id}>…</TableRow>
//       )}
//     />
//
//   When `columns` is provided, `renderHeader` and `renderRow` are ignored entirely.
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React, { useMemo, useState } from 'react';
import {
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    MoreHorizontal,
    RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AppEmptyState } from '@/components/AppEmptyState';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';


// ─── Types ────────────────────────────────────────────────────────────────────

/** Current sort direction for a column. `null` means the column is unsorted. */
export type SortDirection = 'asc' | 'desc' | null;

/**
 * Defines a single column in the columns-API mode of DataTable.
 *
 * Minimal column (label + auto cell from item[key]):
 *   { key: 'name', label: 'Name' }
 *
 * Fixed-width sortable column:
 *   { key: 'credits', label: 'Credits', width: 90, sortable: true }
 *
 * Custom-rendered cell (e.g. badge, switch, action menu):
 *   { key: 'status', label: 'Status', cell: (item) => <Badge>{item.status}</Badge> }
 */
export interface ColumnDef<T> {
    /** Unique column key. Used as the React key and — when `cell` is omitted — to read `item[key]`. */
    key: string;

    /**
     * Content rendered inside the <th>. Accepts any ReactNode (plain text, icon + text, etc.).
     * Interactive elements in the header (e.g. a Switch) cannot be expressed here — use the
     * `renderHeader` render-prop fallback instead.
     */
    label: React.ReactNode;

    /** Horizontal alignment applied to both the <th> and every <td> in this column. Default: 'left'. */
    align?: 'left' | 'center' | 'right';

    // ── Width ─────────────────────────────────────────────────────────────────

    /**
     * Fixed column width.
     *   number → treated as pixels  (e.g. 90  →  "90px")
     *   string → passed through verbatim  (e.g. "20%", "8rem")
     *
     * Setting this on any column triggers table-layout:fixed + <colgroup> for the entire table.
     */
    width?: number | string;

    /**
     * Minimum column width in pixels.
     * Prevents fill columns from collapsing too far on narrow viewports.
     * Only meaningful when `width` or `fit` is also set.
     */
    minWidth?: number;

    /**
     * 'fill' — column grows to absorb all leftover table width after fixed-width columns are placed.
     * When multiple columns share fit:'fill' they divide the remaining space equally.
     *
     * Setting this on any column triggers table-layout:fixed + <colgroup> for the entire table.
     */
    fit?: 'fill';

    // ── Sorting ───────────────────────────────────────────────────────────────

    /**
     * Enables client-side sorting for this column.
     *
     *   true      → default comparator  (string → localeCompare, number → a−b, else String())
     *   function  → custom comparator   (a: T, b: T) => number, same contract as Array.sort
     *
     * Click cycle on the column header:  none  →  asc  →  desc  →  none
     */
    sortable?: boolean | ((a: T, b: T) => number);

    // ── Cell rendering ────────────────────────────────────────────────────────

    /**
     * Custom renderer for each <td> in this column.
     * Receives the row item and its current (post-sort) array index.
     * When omitted the value at `item[key]` is rendered as a plain string
     * (booleans → "Yes"/"No", null/undefined → empty).
     */
    cell?: (item: T, index: number) => React.ReactNode;

    // ── Style overrides ───────────────────────────────────────────────────────

    /** Extra className applied to the <th> of this column. */
    headerClassName?: string;

    /**
     * Extra className applied to every <td> in this column.
     * Accepts a static string or a per-row function for conditional styling.
     */
    cellClassName?: string | ((item: T) => string);
}


// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Reads item[key] and converts it to a renderable node with sensible defaults. */
function defaultCellValue<T>(item: T, key: string): React.ReactNode {
    const value = (item as Record<string, unknown>)[key];
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
}

/** Default sort comparator used when sortable:true (no custom function supplied). */
function defaultComparator<T>(a: T, b: T, key: string): number {
    const av = (a as Record<string, unknown>)[key];
    const bv = (b as Record<string, unknown>)[key];
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av ?? '').localeCompare(String(bv ?? ''));
}

/** Normalises a column width value to a CSS string (e.g. 90 → "90px"). */
function resolveWidth(width: number | string | undefined): string | undefined {
    if (width === undefined) return undefined;
    return typeof width === 'number' ? `${width}px` : width;
}

const ALIGN_CLASS: Record<'left' | 'center' | 'right', string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
};

const SORT_ICON = {
    null: ChevronsUpDown,
    asc: ChevronUp,
    desc: ChevronDown,
} as const;


// ─── Sub-components ───────────────────────────────────────────────────────────

const TableShell: React.FC<{
    children: React.ReactNode;
    minWidthClassName?: string;
    className?: string;
}> = ({ children, minWidthClassName, className }) => (
    <div className={cn('w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-md border border-border/70', className)}>
        <div className={cn('min-w-full', minWidthClassName)}>
            {children}
        </div>
    </div>
);

const EmptyTableRow: React.FC<{ colSpan: number; message: string; className?: string }> = ({
    colSpan,
    message,
    className,
}) => (
    <TableRow className="h-full hover:bg-transparent">
        <TableCell colSpan={colSpan} className={cn('h-full p-0 align-middle', className)}>
            <AppEmptyState
                scenario="create"
                size="section"
                surface="inherit"
                className="h-full min-h-[15rem] rounded-none border-0 px-6 py-10"
                title={message}
                description="This table is empty right now."
            />
        </TableCell>
    </TableRow>
);

const PanelHeader: React.FC<{
    title: string;
    description: string;
    right?: React.ReactNode;
}> = ({ title, description, right }) => (
    <div className="flex w-full min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-base font-semibold tracking-tight">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {right ? (
            <div className="flex shrink-0 justify-end pl-3">
                {right}
            </div>
        ) : null}
    </div>
);


// ─── DataTable ────────────────────────────────────────────────────────────────

export interface DataTableProps<T> {
    // ── Panel header ──────────────────────────────────────────────────────────
    title: string;
    description: string;
    /** Button / action node rendered on the right side of the panel header. */
    actionButton?: React.ReactNode;
    /** Set false to hide the title/description block (e.g. when the parent already has a header). */
    showHeader?: boolean;

    // ── Data ──────────────────────────────────────────────────────────────────
    items: T[];

    // ── Column API (preferred) ────────────────────────────────────────────────
    /**
     * Declarative column definitions. When provided, all <thead> and <tbody> rendering is
     * handled internally — no renderHeader / renderRow needed.
     * See the file-header COLUMN API QUICK REFERENCE for full usage examples.
     */
    columns?: ColumnDef<T>[];

    /**
     * Stable React key extractor used in columns mode.
     * Defaults to `(item as any).id` when available, then falls back to the array index.
     *
     * Always supply this when items have a natural unique id to avoid React reconciliation issues.
     */
    getRowKey?: (item: T, index: number) => React.Key;

    // ── Render-props fallback (ignored when `columns` is provided) ─────────────
    /**
     * Renders the full <TableRow> inside <TableHeader>.
     * Only used when `columns` is not provided.
     * Use this when a header cell must contain interactive elements (e.g. a bulk Switch).
     */
    renderHeader?: () => React.ReactNode;

    /**
     * Renders a full <TableRow> for each item inside <TableBody>.
     * Only used when `columns` is not provided.
     * Must include a stable `key` prop on the returned <TableRow>.
     */
    renderRow?: (item: T, index: number) => React.ReactNode;

    // ── Display options ───────────────────────────────────────────────────────
    /** Message shown in the empty-state cell when items is empty. Default: 'No items found.' */
    emptyMessage?: string;
    /**
     * Tailwind min-width class applied to the inner scroll wrapper.
     * Controls when horizontal scrolling kicks in (e.g. "min-w-[38rem] sm:min-w-[44rem]").
     * Omit to let the table fill available width without a minimum.
     */
    minWidthClassName?: string;
    /** When true, replaces table rows with a centered loading spinner. */
    isLoading?: boolean;

    // ── Style overrides ───────────────────────────────────────────────────────
    /** Extra className on the outermost wrapper div. */
    rootClassName?: string;
    /** Extra className on the overflow scroll shell. */
    shellClassName?: string;
    /** Extra className on the <Table> element. */
    tableClassName?: string;
    /** Extra className on the empty-state <TableCell>. */
    emptyRowClassName?: string;
}

export function DataTable<T>({
    title,
    description,
    actionButton,
    showHeader = true,
    items,
    columns,
    getRowKey,
    renderHeader,
    renderRow,
    emptyMessage = 'No items found.',
    minWidthClassName,
    isLoading,
    rootClassName,
    shellClassName,
    tableClassName,
    emptyRowClassName,
}: DataTableProps<T>) {

    // ── Sort state ─────────────────────────────────────────────────────────────
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<SortDirection>(null);

    /**
     * Cycles through none → asc → desc → none.
     * Clicking a different column resets to asc immediately.
     */
    const handleSortClick = (key: string) => {
        if (sortKey !== key) {
            setSortKey(key);
            setSortDir('asc');
        } else if (sortDir === 'asc') {
            setSortDir('desc');
        } else {
            // desc → reset
            setSortKey(null);
            setSortDir(null);
        }
    };

    // ── Sorted items ───────────────────────────────────────────────────────────
    const sortedItems = useMemo(() => {
        if (!columns || !sortKey || !sortDir) return items;
        const col = columns.find((c) => c.key === sortKey);
        if (!col?.sortable) return items;

        const comparator =
            typeof col.sortable === 'function'
                ? col.sortable
                : (a: T, b: T) => defaultComparator(a, b, sortKey);

        const sorted = [...items].sort(comparator);
        return sortDir === 'desc' ? sorted.reverse() : sorted;
    }, [items, columns, sortKey, sortDir]);

    // ── Layout flags ───────────────────────────────────────────────────────────
    /**
     * Switch to table-layout:fixed (+ colgroup) as soon as any column declares an
     * explicit width or fit:'fill'. Otherwise keep table-layout:auto so the browser
     * can measure content and distribute space naturally.
     */
    const useFixedLayout = columns?.some((c) => c.width !== undefined || c.fit === 'fill') ?? false;

    const displayItems = columns ? sortedItems : items;

    // ── Row key helper ─────────────────────────────────────────────────────────
    const resolveRowKey = (item: T, index: number): React.Key => {
        if (getRowKey) return getRowKey(item, index);
        const id = (item as Record<string, unknown>).id;
        return (id !== undefined && id !== null) ? String(id) : index;
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className={cn('w-full min-w-0 space-y-4', rootClassName)}>

            {/* Panel header — title + description + optional action button */}
            {showHeader ? (
                <div className="w-full min-w-0 px-1">
                    <PanelHeader title={title} description={description} right={actionButton} />
                </div>
            ) : actionButton ? (
                <div className="flex w-full min-w-0 justify-end px-1">
                    {actionButton}
                </div>
            ) : null}

            <TableShell minWidthClassName={minWidthClassName} className={shellClassName}>
                <Table
                    className={cn(
                        'min-w-full w-full',
                        // Fixed layout when any column controls its own width; auto otherwise.
                        useFixedLayout ? 'table-fixed' : [
                            'table-auto',
                            // Auto-mode guards: prevent any single column from getting too
                            // narrow (min) or too wide (max) without explicit caller control.
                            '[&_td]:min-w-[6rem] [&_td]:max-w-[18rem]',
                            '[&_td]:overflow-hidden [&_td]:text-ellipsis [&_td]:whitespace-nowrap',
                            '[&_th]:min-w-[6rem] [&_th]:max-w-[18rem]',
                            '[&_th]:overflow-hidden [&_th]:text-ellipsis [&_th]:whitespace-nowrap',
                        ],
                        !isLoading && displayItems.length === 0 ? 'h-full' : null,
                        tableClassName,
                    )}
                >

                    {/*
                      colgroup — only rendered in fixed-layout mode.
                      Fixed-width columns get an explicit width; fit:'fill' columns get no
                      width (browser stretches them to fill the remainder); minWidth is
                      applied via inline style to guard against over-squeezing.
                    */}
                    {useFixedLayout && columns && (
                        <colgroup>
                            {columns.map((col) => (
                                <col
                                    key={col.key}
                                    style={{
                                        width: col.fit === 'fill' ? undefined : resolveWidth(col.width),
                                        minWidth: col.minWidth !== undefined ? `${col.minWidth}px` : undefined,
                                    }}
                                />
                            ))}
                        </colgroup>
                    )}

                    {/* ── Header ─────────────────────────────────────────── */}
                    <TableHeader>
                        {columns ? (
                            <TableRow>
                                {columns.map((col) => {
                                    const align = col.align ?? 'left';
                                    const isSortable = Boolean(col.sortable);
                                    const isActiveSortCol = sortKey === col.key;
                                    const currentDir: SortDirection = isActiveSortCol ? sortDir : null;
                                    const SortIcon = SORT_ICON[currentDir ?? 'null'];

                                    return (
                                        <TableHead
                                            key={col.key}
                                            className={cn(
                                                ALIGN_CLASS[align],
                                                isSortable && 'cursor-pointer select-none',
                                                col.headerClassName,
                                            )}
                                            onClick={isSortable ? () => handleSortClick(col.key) : undefined}
                                        >
                                            {isSortable ? (
                                                <span className="inline-flex items-center gap-1">
                                                    {col.label}
                                                    <SortIcon
                                                        className={cn(
                                                            'h-3.5 w-3.5 shrink-0 transition-colors',
                                                            // Active sort icon: full foreground; inactive: faint hint.
                                                            isActiveSortCol && currentDir !== null
                                                                ? 'text-foreground'
                                                                : 'text-muted-foreground/40',
                                                        )}
                                                    />
                                                </span>
                                            ) : (
                                                col.label
                                            )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ) : (
                            renderHeader?.()
                        )}
                    </TableHeader>

                    {/* ── Body ───────────────────────────────────────────── */}
                    <TableBody className={!isLoading && displayItems.length === 0 ? 'h-full' : undefined}>

                        {/* Loading state */}
                        {isLoading && (
                            <TableRow>
                                <TableCell colSpan={100} className="py-8 text-center text-sm text-muted-foreground">
                                    <div className="flex justify-center">
                                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground/50" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}

                        {/* Empty state */}
                        {!isLoading && displayItems.length === 0 && (
                            <EmptyTableRow colSpan={100} message={emptyMessage} className={emptyRowClassName} />
                        )}

                        {/* Columns-API rows */}
                        {!isLoading && columns && displayItems.map((item, index) => (
                            <TableRow key={resolveRowKey(item, index)}>
                                {columns.map((col) => {
                                    const align = col.align ?? 'left';
                                    const extraClass =
                                        typeof col.cellClassName === 'function'
                                            ? col.cellClassName(item)
                                            : col.cellClassName;
                                    return (
                                        <TableCell
                                            key={col.key}
                                            className={cn(ALIGN_CLASS[align], extraClass)}
                                        >
                                            {col.cell
                                                ? col.cell(item, index)
                                                : defaultCellValue(item, col.key)}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}

                        {/* Render-props rows (fallback) */}
                        {!isLoading && !columns && displayItems.map((item, index) =>
                            renderRow?.(item, index),
                        )}
                    </TableBody>
                </Table>
            </TableShell>
        </div>
    );
}


// ─── DataTableActionMenu ──────────────────────────────────────────────────────

/**
 * Pre-styled three-dot dropdown trigger for per-row action menus.
 * Place DropdownMenuItems (and optionally DropdownMenuSeparators) as children.
 *
 *   <DataTableActionMenu triggerLabel={`Actions for ${item.name}`}>
 *     <DropdownMenuItem onClick={…}>Edit</DropdownMenuItem>
 *     <DropdownMenuSeparator />
 *     <DropdownMenuItem variant="destructive" onClick={…}>Delete</DropdownMenuItem>
 *   </DataTableActionMenu>
 */
export function DataTableActionMenu({
    children,
    triggerLabel = 'Open menu',
    contentClassName,
    align = 'end',
    disabled = false,
}: {
    children: React.ReactNode;
    triggerLabel?: string;
    contentClassName?: string;
    align?: React.ComponentProps<typeof DropdownMenuContent>['align'];
    disabled?: boolean;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    className="h-8 w-8 p-0 data-[state=open]:bg-muted"
                    disabled={disabled}
                    aria-label={triggerLabel}
                    title={triggerLabel}
                >
                    <span className="sr-only">{triggerLabel}</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align} className={cn('min-w-40', contentClassName)}>
                {children}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}


export { TableShell, EmptyTableRow, PanelHeader };
