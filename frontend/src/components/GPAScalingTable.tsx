// input:  [serialized GPA mapping JSON, parse/coverage validation logic, and shared business empty-state wrappers]
// output: [`GPAScalingTable` component]
// pos:    [Settings control for authoring percentage-to-GPA conversion rules with standardized create-empty feedback; entries are
//          auto-sorted by min score descending; input uses explicit min/max/GPA fields, continuous coverage warnings, and AlertDialog-backed delete confirmation]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useState, useEffect, useMemo } from 'react';
import { DataTable, DataTableActionMenu, type ColumnDef } from '@/components/DataTable';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Trash2 } from 'lucide-react';

interface GPAScalingTableProps {
    value: string; // JSON string, e.g. {"85-100": 4.0, "0-84": 0}
    onChange: (value: string) => void;
}

interface GpaEntry {
    min: number;
    max: number;
    gpa: number;
}

const SCORE_DOMAIN_END = 100;
const RANGE_TOLERANCE = 1e-9;

function getExclusiveRangeEnd(entry: Pick<GpaEntry, 'min' | 'max'>): number {
    const min = Math.min(entry.min, entry.max);
    const max = Math.max(entry.min, entry.max);

    if (Number.isInteger(min) && Number.isInteger(max)) {
        return max >= SCORE_DOMAIN_END ? SCORE_DOMAIN_END + RANGE_TOLERANCE : max + 1;
    }

    return max + RANGE_TOLERANCE;
}

function hasFullContinuousCoverage(entries: GpaEntry[]): boolean {
    if (entries.length === 0) return false;

    const sortedEntries = [...entries].sort((left, right) => (
        left.min - right.min || left.max - right.max
    ));

    let coveredUntil = 0;
    for (const entry of sortedEntries) {
        const start = Math.min(entry.min, entry.max);
        const end = getExclusiveRangeEnd(entry);

        if (end <= start + RANGE_TOLERANCE) continue;
        if (start > coveredUntil + RANGE_TOLERANCE) return false;

        coveredUntil = Math.max(coveredUntil, end);
        if (coveredUntil >= SCORE_DOMAIN_END + RANGE_TOLERANCE) {
            return true;
        }
    }

    return coveredUntil >= SCORE_DOMAIN_END + RANGE_TOLERANCE;
}

/** Parse JSON → sorted GpaEntry[] (high min first) */
function parseEntries(json: string): GpaEntry[] {
    try {
        if (!json || json === '{}') return [];
        const parsed: Record<string, number> = JSON.parse(json);
        return Object.entries(parsed)
            .map(([range, gpa]) => {
                const parts = range.split('-').map(s => parseFloat(s.trim()));
                if (parts.length !== 2 || parts.some(isNaN)) return null;
                return { min: Math.min(parts[0], parts[1]), max: Math.max(parts[0], parts[1]), gpa };
            })
            .filter((e): e is GpaEntry => e !== null)
            .sort((a, b) => b.min - a.min);
    } catch {
        return [];
    }
}

/** Serialize sorted entries back to JSON */
function serializeEntries(entries: GpaEntry[]): string {
    const obj: Record<string, number> = {};
    // Sort high-first for canonical JSON order
    [...entries]
        .sort((a, b) => b.min - a.min)
        .forEach(e => {
            obj[`${e.min}-${e.max}`] = e.gpa;
        });
    return JSON.stringify(obj);
}

export function GPAScalingTable({ value, onChange }: GPAScalingTableProps) {
    const [entries, setEntries] = useState<GpaEntry[]>([]);
    const [pendingDeleteEntry, setPendingDeleteEntry] = useState<GpaEntry | null>(null);

    // Sync from parent JSON
    useEffect(() => {
        setEntries(parseEntries(value));
    }, [value]);

    // ------ Add form state ------
    const [newMin, setNewMin] = useState('');
    const [newMax, setNewMax] = useState('');
    const [newGpa, setNewGpa] = useState('');
    const [error, setError] = useState('');

    const handleAdd = () => {
        setError('');
        const min = parseFloat(newMin);
        const max = parseFloat(newMax);
        const gpa = parseFloat(newGpa);

        if (isNaN(min) || isNaN(max) || isNaN(gpa)) {
            setError('All fields are required and must be numbers.');
            return;
        }
        if (min < 0 || max > 100) {
            setError('Min must be ≥ 0 and Max must be ≤ 100.');
            return;
        }
        if (min > max) {
            setError('Min must be ≤ Max.');
            return;
        }
        if (gpa < 0) {
            setError('GPA must be ≥ 0.');
            return;
        }

        // Check for exact duplicate range
        if (entries.some(e => e.min === min && e.max === max)) {
            setError('A rule for this range already exists.');
            return;
        }

        const updated = [...entries, { min, max, gpa }].sort((a, b) => b.min - a.min);
        setEntries(updated);
        onChange(serializeEntries(updated));
        setNewMin('');
        setNewMax('');
        setNewGpa('');
    };

    const handleRemove = (entry: GpaEntry) => {
        const updated = entries
            .filter(e => !(e.min === entry.min && e.max === entry.max))
            .sort((a, b) => b.min - a.min);
        setEntries(updated);
        onChange(serializeEntries(updated));
    };

    const isFullCoverage = useMemo(() => {
        return hasFullContinuousCoverage(entries);
    }, [entries]);

    const columns: ColumnDef<GpaEntry>[] = [
        {
            key: 'scoreRange',
            label: 'Score Range',
            fit: 'fill',
            cell: (entry) => (
                <span className="tabular-nums">
                    <span className="font-medium text-foreground">{entry.min}</span>
                    <span className="text-muted-foreground/40 mx-1.5">–</span>
                    <span className="font-medium text-foreground">{entry.max}</span>
                    <span className="text-[10px] text-muted-foreground/60 ml-1">%</span>
                </span>
            ),
        },
        {
            key: 'gpa',
            label: 'Resulting GPA',
            width: 160,
            cell: (entry) => (
                <span className="font-semibold tabular-nums text-primary">
                    {entry.gpa.toFixed(1)}
                    <span className="text-muted-foreground/50 font-normal text-xs ml-1">GPA</span>
                </span>
            ),
        },
        {
            key: 'actions',
            label: '',
            width: 56,
            align: 'right',
            cell: (entry) => (
                <DataTableActionMenu triggerLabel={`Actions for ${entry.min}–${entry.max}`}>
                    <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setPendingDeleteEntry(entry)}
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete rule
                    </DropdownMenuItem>
                </DataTableActionMenu>
            ),
        },
    ];

    return (
        <div className="space-y-4">

            <DataTable
                title=""
                description=""
                showHeader={false}
                items={entries}
                columns={columns}
                getRowKey={(entry) => `${entry.min}-${entry.max}`}
                emptyMessage="No scaling rules defined."
            />

            {/* Coverage warning */}
            {entries.length > 0 && !isFullCoverage && (
                <p className="text-[13px] text-amber-600 font-medium flex items-center gap-1.5">
                    <span>⚠️</span> This table does not cover the full 0–100% range. Some grades might not map correctly.
                </p>
            )}

            {/* Add-rule form */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end pt-2">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="gpa-min" className="text-xs">Min Score</Label>
                    <div className="relative">
                        <Input
                            id="gpa-min"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            placeholder="0"
                            value={newMin}
                            onChange={e => { setNewMin(e.target.value); setError(''); }}
                            className="pr-6 tabular-nums"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">%</span>
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="gpa-max" className="text-xs">Max Score</Label>
                    <div className="relative">
                        <Input
                            id="gpa-max"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            placeholder="100"
                            value={newMax}
                            onChange={e => { setNewMax(e.target.value); setError(''); }}
                            className="pr-6 tabular-nums"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">%</span>
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="gpa-value" className="text-xs">Resulting GPA</Label>
                    <Input
                        id="gpa-value"
                        type="number"
                        min={0}
                        step={0.1}
                        placeholder="4.0"
                        value={newGpa}
                        onChange={e => { setNewGpa(e.target.value); setError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                        className="tabular-nums"
                    />
                </div>
                <Button
                    type="button"
                    onClick={handleAdd}
                    disabled={!newMin || !newMax || !newGpa}
                    className="w-full sm:w-auto px-6"
                >
                    Add
                </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}

            {/* Controlled delete confirmation dialog — rendered outside the dropdown to avoid nesting issues */}
            <AlertDialog
                open={pendingDeleteEntry !== null}
                onOpenChange={(open) => { if (!open) setPendingDeleteEntry(null); }}
            >
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete scaling rule?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Remove the {pendingDeleteEntry?.min}-{pendingDeleteEntry?.max}% rule from this GPA scaling table.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                                if (pendingDeleteEntry) handleRemove(pendingDeleteEntry);
                                setPendingDeleteEntry(null);
                            }}
                        >
                            Delete rule
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
