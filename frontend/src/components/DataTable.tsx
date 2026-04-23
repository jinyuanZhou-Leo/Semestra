// Shared settings-table shell with two authoring modes:
// 1. columns API for standard sortable/paginated tables
// 2. render props for custom header or row markup
// Sorting and pagination are client-side; callback indexes stay absolute across pages.

import { useEffect, useMemo, useRef, useState, type ComponentProps, type Key, type ReactNode } from 'react';
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
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import {
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
    label: ReactNode;

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
    cell?: (item: T, index: number) => ReactNode;

    /** When true, clips custom JSX cell content with a single-line ellipsis. */
    truncateCell?: boolean;

    // ── Style overrides ───────────────────────────────────────────────────────

    /** Extra className applied to the <th> of this column. */
    headerClassName?: string;

    /**
     * Extra className applied to every <td> in this column.
     * Accepts a static string or a per-row function for conditional styling.
     */
    cellClassName?: string | ((item: T) => string);
}

interface DataTableSortState {
    key: string | null;
    direction: SortDirection;
}


// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Reads item[key] and converts it to a renderable node with sensible defaults. */
function defaultCellValue<T>(item: T, key: string): ReactNode {
    const value = (item as Record<string, unknown>)[key];
    if (value === null || value === undefined) return null;
    const textValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
    return renderTextCell(textValue);
}

function renderTextCell(textValue: string): ReactNode {
    return (
        <span className="block min-w-0 truncate" title={textValue}>
            {textValue}
        </span>
    );
}

/** Default sort comparator used when sortable:true (no custom function supplied). */
function defaultComparator<T>(a: T, b: T, key: string): number {
    const av = (a as Record<string, unknown>)[key];
    const bv = (b as Record<string, unknown>)[key];
    // Both numeric → numeric diff; anything else (including mixed types) → string compare.
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av ?? '').localeCompare(String(bv ?? ''));
}

/** Normalises a column width value to a CSS string (e.g. 90 → "90px"). */
function resolveWidth(width: number | string | undefined): string | undefined {
    if (width === undefined) return undefined;
    return typeof width === 'number' ? `${width}px` : width;
}

function resolveSize(size: number | string | undefined): string | undefined {
    if (size === undefined) return undefined;
    return typeof size === 'number' ? `${size}px` : size;
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

type PaginationEntry = number | 'ellipsis';
const DEFAULT_PAGE_SIZE = 10;

function readPersistedSortState(storageKey?: string): DataTableSortState {
    if (!storageKey || typeof window === 'undefined') {
        return { key: null, direction: null };
    }

    try {
        const rawValue = window.localStorage.getItem(storageKey);
        if (!rawValue) return { key: null, direction: null };
        const parsed = JSON.parse(rawValue) as Partial<DataTableSortState>;
        const direction = parsed.direction === 'asc' || parsed.direction === 'desc' ? parsed.direction : null;
        return {
            key: typeof parsed.key === 'string' ? parsed.key : null,
            direction,
        };
    } catch {
        return { key: null, direction: null };
    }
}

function writePersistedSortState(storageKey: string | undefined, sortState: DataTableSortState) {
    if (!storageKey || typeof window === 'undefined') {
        return;
    }

    try {
        if (!sortState.key || !sortState.direction) {
            window.localStorage.removeItem(storageKey);
            return;
        }
        window.localStorage.setItem(storageKey, JSON.stringify(sortState));
    } catch {
        // Browsers may block storage; table sorting should still work in memory.
    }
}

function buildPaginationEntries(totalPages: number, currentPage: number): PaginationEntry[] {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (currentPage <= 4) {
        return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
    }

    if (currentPage >= totalPages - 3) {
        return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}


// ─── Sub-components ───────────────────────────────────────────────────────────

interface TableShellProps {
    children: ReactNode;
    minWidthClassName?: string;
    className?: string;
}

function TableShell({ children, minWidthClassName, className }: TableShellProps) {
    return (
        <div className={cn('w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-md border border-border/70', className)}>
            <div className={cn('min-w-full', minWidthClassName)}>
                {children}
            </div>
        </div>
    );
}

interface EmptyTableRowProps {
    colSpan: number;
    message: string;
    className?: string;
}

function EmptyTableRow({
    colSpan,
    message,
    className,
}: EmptyTableRowProps) {
    return (
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
}

interface PanelHeaderProps {
    title: string;
    description: string;
    right?: ReactNode;
}

function PanelHeader({ title, description, right }: PanelHeaderProps) {
    return (
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
}


// ─── DataTable ────────────────────────────────────────────────────────────────

export interface DataTableProps<T> {
    // ── Panel header ──────────────────────────────────────────────────────────
    title: string;
    description: string;
    /** Button / action node rendered on the right side of the panel header. */
    actionButton?: ReactNode;
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
    getRowKey?: (item: T, index: number) => Key;

    // ── Render-props fallback (ignored when `columns` is provided) ─────────────
    /**
     * Renders the full <TableRow> inside <TableHeader>.
     * Only used when `columns` is not provided.
     * Use this when a header cell must contain interactive elements (e.g. a bulk Switch).
     */
    renderHeader?: () => ReactNode;

    /**
     * Renders a full <TableRow> for each item inside <TableBody>.
     * Only used when `columns` is not provided.
     * Must include a stable `key` prop on the returned <TableRow>.
     */
    renderRow?: (item: T, index: number) => ReactNode;

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
    /** Fixed height for the scrollable table area. Keeps pagination outside the scroll region. */
    bodyHeight?: number | string;
    /** Maximum height for the scrollable table area. Keeps pagination outside the scroll region. */
    maxBodyHeight?: number | string;
    /** Freezes the table header while the table body scrolls. */
    freezeHeader?: boolean;
    /** Enables built-in client-side pagination when provided. */
    pagination?: {
        /** Number of rows per page. Default: 10. */
        pageSize?: number;
        /** Item label used in the footer count summary. Default: 'items'. */
        itemLabel?: string;
    };
    /** Optional browser-local key for persisting this table's sort preference. */
    sortPersistenceKey?: string;

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
    bodyHeight,
    maxBodyHeight,
    freezeHeader = false,
    pagination,
    sortPersistenceKey,
    rootClassName,
    shellClassName,
    tableClassName,
    emptyRowClassName,
}: DataTableProps<T>) {

    // ── Sort state ─────────────────────────────────────────────────────────────
    const [sortKey, setSortKey] = useState<string | null>(() => readPersistedSortState(sortPersistenceKey).key);
    const [sortDir, setSortDir] = useState<SortDirection>(() => readPersistedSortState(sortPersistenceKey).direction);
    const [currentPage, setCurrentPage] = useState(1);

    /**
     * Cycles through none → asc → desc → none.
     * Clicking a different column resets to asc immediately.
     */
    const handleSortClick = (key: string) => {
        let nextSortState: DataTableSortState;
        if (sortKey !== key) {
            nextSortState = { key, direction: 'asc' };
        } else if (sortDir === 'asc') {
            nextSortState = { key, direction: 'desc' };
        } else {
            nextSortState = { key: null, direction: null };
        }
        setSortKey(nextSortState.key);
        setSortDir(nextSortState.direction);
        writePersistedSortState(sortPersistenceKey, nextSortState);
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

        // Negate comparator for desc — avoids reverse() which breaks stable sort for equal keys.
        const sign = sortDir === 'desc' ? -1 : 1;
        return [...items].sort((a, b) => sign * comparator(a, b));
    }, [items, columns, sortKey, sortDir]);

    // ── Layout flags ───────────────────────────────────────────────────────────
    /**
     * Switch to table-layout:fixed (+ colgroup) as soon as any column declares an
     * explicit width or fit:'fill'. Otherwise keep table-layout:auto so the browser
     * can measure content and distribute space naturally.
     */
    const useFixedLayout = columns?.some((c) => c.width !== undefined || c.fit === 'fill') ?? false;

    const displayItems = columns ? sortedItems : items;
    const hasPagination = pagination !== undefined;
    const paginationPageSize = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
    const totalItems = displayItems.length;
    const totalPages = pagination
        ? Math.max(1, Math.ceil(totalItems / paginationPageSize))
        : 1;
    const visiblePage = Math.min(currentPage, totalPages);
    const visibleItems = useMemo(() => {
        if (!pagination) {
            return displayItems;
        }

        const startIndex = (visiblePage - 1) * paginationPageSize;
        return displayItems.slice(startIndex, startIndex + paginationPageSize);
    }, [displayItems, pagination, paginationPageSize, visiblePage]);
    const rangeStart = totalItems === 0 ? 0 : ((visiblePage - 1) * paginationPageSize) + 1;
    const rangeEnd = totalItems === 0 ? 0 : Math.min(visiblePage * paginationPageSize, totalItems);
    const paginationEntries = pagination
        ? buildPaginationEntries(totalPages, visiblePage)
        : [];
    const hasBoundedBodyHeight = bodyHeight !== undefined || maxBodyHeight !== undefined;
    const scrollAreaStyle = hasBoundedBodyHeight
        ? {
            height: resolveSize(bodyHeight),
            maxHeight: bodyHeight === undefined ? resolveSize(maxBodyHeight) : undefined,
        }
        : undefined;

    useEffect(() => {
        if (!hasPagination) {
            return;
        }
        setCurrentPage(1);
    }, [hasPagination, paginationPageSize, sortDir, sortKey]);

    useEffect(() => {
        const persistedSort = readPersistedSortState(sortPersistenceKey);
        setSortKey(persistedSort.key);
        setSortDir(persistedSort.direction);
    }, [sortPersistenceKey]);

    useEffect(() => {
        if (!hasPagination) return;
        setCurrentPage((p) => (p > totalPages ? totalPages : p));
    }, [hasPagination, totalPages]);

    const pageStartIndex = hasPagination ? (visiblePage - 1) * paginationPageSize : 0;

    const warnedIndexKeyRef = useRef(false);
    const resolveRowKey = (item: T, index: number): Key => {
        if (getRowKey) return getRowKey(item, index);
        const id = (item as Record<string, unknown>).id;
        if (id !== undefined && id !== null) return String(id);
        if (process.env.NODE_ENV !== 'production' && !warnedIndexKeyRef.current && columns?.some((c) => c.sortable)) {
            warnedIndexKeyRef.current = true;
            console.warn('[DataTable] Sortable columns detected but no getRowKey provided. Falling back to index keys may cause reconciliation issues when rows reorder.');
        }
        return index;
    };

    const colCount = columns?.length ?? 1;

    const tableMarkup = (
        <div
            data-slot="data-table-scroll-area"
            className={cn('min-w-0', hasBoundedBodyHeight && 'min-h-0 overflow-x-hidden overflow-y-auto')}
            style={scrollAreaStyle}
        >
            <TableShell
                minWidthClassName={minWidthClassName}
                className={cn(pagination && 'rounded-none border-0', shellClassName)}
            >
                <table
                    data-slot="table"
                    className={cn(
                        'caption-bottom text-sm min-w-full w-full',
                        // Fixed layout when any column controls its own width; auto otherwise.
                        useFixedLayout ? 'table-fixed' : [
                            'table-auto',
                            // Auto-mode guards: prevent any single column from getting too
                            // narrow (min) or too wide (max) without explicit caller control.
                            '[&_td]:min-w-[6rem] [&_td]:max-w-[18rem]',
                            '[&_th]:min-w-[6rem] [&_th]:max-w-[18rem]',
                            '[&_th]:overflow-hidden [&_th]:text-ellipsis [&_th]:whitespace-nowrap',
                        ],
                        !isLoading && visibleItems.length === 0 ? 'h-full' : null,
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
                    <TableHeader className={cn(
                        freezeHeader && hasBoundedBodyHeight && '[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-background',
                    )}>
                        {columns ? (
                            <TableRow>
                                {columns.map((col) => {
                                    const align = col.align ?? 'left';
                                    const isSortable = Boolean(col.sortable);
                                    const isActiveSortCol = sortKey === col.key;
                                    const currentDir: SortDirection = isActiveSortCol ? sortDir : null;
                                    const SortIcon = SORT_ICON[currentDir ?? 'null'];

                                    const ariaSort = isSortable
                                        ? (isActiveSortCol && sortDir === 'asc' ? 'ascending' : isActiveSortCol && sortDir === 'desc' ? 'descending' : 'none')
                                        : undefined;

                                    return (
                                        <TableHead
                                            key={col.key}
                                            tabIndex={isSortable ? 0 : undefined}
                                            aria-sort={ariaSort}
                                            className={cn(
                                                'overflow-hidden text-ellipsis whitespace-nowrap',
                                                ALIGN_CLASS[align],
                                                isSortable && 'cursor-pointer select-none',
                                                col.headerClassName,
                                            )}
                                            onClick={isSortable ? () => handleSortClick(col.key) : undefined}
                                            onKeyDown={isSortable ? (e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    handleSortClick(col.key);
                                                }
                                            } : undefined}
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
                    <TableBody className={!isLoading && visibleItems.length === 0 ? 'h-full' : undefined}>

                        {/* Loading state */}
                        {isLoading && (
                            <TableRow>
                                <TableCell colSpan={colCount} className="py-8 text-center text-sm text-muted-foreground">
                                    <div className="flex justify-center">
                                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground/50" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}

                        {/* Empty state */}
                        {!isLoading && visibleItems.length === 0 && (
                            <EmptyTableRow colSpan={colCount} message={emptyMessage} className={emptyRowClassName} />
                        )}

                        {/* Columns-API rows */}
                        {!isLoading && columns && visibleItems.map((item, index) => {
                            const absoluteIndex = pageStartIndex + index;

                            return (
                                <TableRow key={resolveRowKey(item, absoluteIndex)}>
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
                                                {col.cell ? (
                                                    <div className={cn('min-w-0', col.truncateCell && 'overflow-hidden text-ellipsis whitespace-nowrap')}>
                                                        {(() => {
                                                            const cellContent = col.cell(item, absoluteIndex);
                                                            if (typeof cellContent === 'string' || typeof cellContent === 'number') {
                                                                return renderTextCell(String(cellContent));
                                                            }
                                                            return cellContent;
                                                        })()}
                                                    </div>
                                                ) : defaultCellValue(item, col.key)}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            );
                        })}

                        {/* Render-props rows (fallback) */}
                        {!isLoading && !columns && visibleItems.map((item, index) =>
                            renderRow?.(item, pageStartIndex + index),
                        )}
                    </TableBody>
                </table>
            </TableShell>
        </div>
    );

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

            {pagination ? (
                <div className="overflow-hidden rounded-md border border-border/70">
                    {tableMarkup}
                    <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                        <span>
                            Showing {rangeStart}-{rangeEnd} of {totalItems} {pagination.itemLabel ?? 'items'}
                        </span>
                        <Pagination className="mx-0 w-full justify-end sm:w-auto">
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        href="#"
                                        text="Previous"
                                        aria-disabled={visiblePage <= 1}
                                        tabIndex={visiblePage <= 1 ? -1 : undefined}
                                        className={cn(visiblePage <= 1 && 'pointer-events-none opacity-50')}
                                        onClick={(event) => {
                                            event.preventDefault();
                                            if (visiblePage > 1) {
                                                setCurrentPage(visiblePage - 1);
                                            }
                                        }}
                                    />
                                </PaginationItem>
                                {paginationEntries.map((entry, index) => (
                                    entry === 'ellipsis' ? (
                                        <PaginationItem key={`ellipsis-${index}`}>
                                            <PaginationEllipsis />
                                        </PaginationItem>
                                    ) : (
                                        <PaginationItem key={entry}>
                                            <PaginationLink
                                                href="#"
                                                isActive={entry === visiblePage}
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    setCurrentPage(entry);
                                                }}
                                            >
                                                {entry}
                                            </PaginationLink>
                                        </PaginationItem>
                                    )
                                ))}
                                <PaginationItem>
                                    <PaginationNext
                                        href="#"
                                        text="Next"
                                        aria-disabled={visiblePage >= totalPages}
                                        tabIndex={visiblePage >= totalPages ? -1 : undefined}
                                        className={cn(visiblePage >= totalPages && 'pointer-events-none opacity-50')}
                                        onClick={(event) => {
                                            event.preventDefault();
                                            if (visiblePage < totalPages) {
                                                setCurrentPage(visiblePage + 1);
                                            }
                                        }}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                </div>
            ) : (
                tableMarkup
            )}
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
    children: ReactNode;
    triggerLabel?: string;
    contentClassName?: string;
    align?: ComponentProps<typeof DropdownMenuContent>['align'];
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
