// input:  [serialized GPA mapping JSON, parse/coverage validation logic]
// output: [`GPAScalingTable` component]
// pos:    [Settings control for authoring percentage-to-GPA conversion rules; entries are
//          auto-sorted by min score descending; input uses explicit min/max/GPA fields]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export const GPAScalingTable: React.FC<GPAScalingTableProps> = ({ value, onChange }) => {
    const [entries, setEntries] = useState<GpaEntry[]>([]);

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

    const handleRemove = (index: number) => {
        const updated = entries.filter((_, i) => i !== index).sort((a, b) => b.min - a.min);
        setEntries(updated);
        onChange(serializeEntries(updated));
    };

    // Coverage check: all integers 0-100 must be covered
    const isFullCoverage = useMemo(() => {
        if (entries.length === 0) return false;
        for (let p = 0; p <= 100; p++) {
            const covered = entries.some(e => p >= e.min && p <= e.max);
            if (!covered) return false;
        }
        return true;
    }, [entries]);

    return (
        <div className="space-y-4">

            {/* Existing rows (auto-sorted) */}
            {entries.length > 0 ? (
                <div className="rounded-md border bg-background shadow-sm overflow-hidden transition-all">
                    <div className="divide-y relative">
                        {entries.map((entry, idx) => (
                            <div
                                key={`${entry.min}-${entry.max}`}
                                className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors group"
                            >
                                <div className="flex flex-1 items-center gap-4">
                                    <div className="flex items-center justify-between min-w-[5.5rem] text-sm tabular-nums text-muted-foreground gap-1.5 whitespace-nowrap">
                                        <span className="font-medium text-foreground w-7 text-right">{entry.min}</span>
                                        <span className="text-muted-foreground/40">-</span>
                                        <span className="font-medium text-foreground w-9 text-left">{entry.max} <span className="text-[10px] text-muted-foreground/60 ml-[1px]">%</span></span>
                                    </div>
                                    <div className="h-4 w-[1px] bg-border/60 hidden sm:block mx-1"></div>
                                    <span className="font-semibold tabular-nums text-primary text-sm">
                                        {entry.gpa.toFixed(1)} <span className="text-muted-foreground/50 font-normal text-xs ml-0.5">GPA</span>
                                    </span>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    type="button"
                                    onClick={() => handleRemove(idx)}
                                    className="h-8 w-8 text-muted-foreground md:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-destructive/10 hover:text-destructive -mr-2 transition-all"
                                    aria-label={`Remove rule ${entry.min}–${entry.max}`}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                    No scaling rules defined. Add a rule below to get started.
                </div>
            )}

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
        </div>
    );
};
