import React, { useState, useEffect, useMemo } from 'react';
import { KeyValueTable, type KeyValueEntry } from './KeyValueTable';

interface GPAScalingTableProps {
    value: string; // JSON string
    onChange: (value: string) => void;
}

export const GPAScalingTable: React.FC<GPAScalingTableProps> = ({ value, onChange }) => {
    const [entries, setEntries] = useState<KeyValueEntry[]>([]);

    // Parse initial value
    useEffect(() => {
        try {
            if (!value || value === '{}') {
                setEntries([]);
                return;
            }
            const parsed = JSON.parse(value);
            const loadedEntries: KeyValueEntry[] = Object.entries(parsed).map(([range, gpa]) => ({
                key: range,
                value: String(gpa)
            }));
            setEntries(loadedEntries);
        } catch (e) {
            console.error("Failed to parse GPA table JSON", e);
        }
    }, [value]);

    const updateParent = (currentEntries: KeyValueEntry[]) => {
        const rulesObj: Record<string, number> = {};
        currentEntries.forEach(entry => {
            rulesObj[entry.key] = parseFloat(entry.value);
        });
        onChange(JSON.stringify(rulesObj));
    };

    const handleAdd = (key: string, value: string) => {
        const updatedEntries = [...entries, { key, value }];
        setEntries(updatedEntries);
        updateParent(updatedEntries);
    };

    const handleRemove = (key: string) => {
        const updatedEntries = entries.filter(e => e.key !== key);
        setEntries(updatedEntries);
        updateParent(updatedEntries);
    };

    const validateGPA = (val: string) => {
        const gpaNum = parseFloat(val);
        if (isNaN(gpaNum)) return 'GPA must be a number';
        return null;
    };

    const isFullCoverage = useMemo(() => {
        if (entries.length === 0) return false;

        const table: Record<string, number> = {};
        entries.forEach(entry => {
            table[entry.key] = parseFloat(entry.value);
        });

        const keys = Object.keys(table);
        if (keys.length === 0) return false;

        const numericEntries = keys
            .filter(k => !k.includes('-'))
            .map(k => ({ key: k, value: parseFloat(k) }))
            .filter(e => !isNaN(e.value))
            .sort((a, b) => b.value - a.value);

        const matches = (percentage: number) => {
            for (const key of keys) {
                const cleanKey = key.trim();
                if (cleanKey.includes('-')) {
                    const parts = cleanKey.split('-').map(s => parseFloat(s.trim()));
                    if (parts.length === 2 && !parts.some(n => isNaN(n))) {
                        const min = Math.min(parts[0], parts[1]);
                        const max = Math.max(parts[0], parts[1]);
                        if (percentage >= min && percentage <= max) return true;
                    }
                } else if (cleanKey.startsWith('>') || cleanKey.startsWith('>=')) {
                    const val = parseFloat(cleanKey.replace(/[^0-9.]/g, ''));
                    if (!isNaN(val) && percentage >= val) return true;
                } else {
                    const val = parseFloat(cleanKey);
                    if (!isNaN(val) && Math.abs(percentage - val) < 0.01) return true;
                }
            }

            if (numericEntries.length > 0) {
                for (const entry of numericEntries) {
                    if (percentage >= entry.value) return true;
                }
            }

            return false;
        };

        for (let p = 0; p <= 100; p += 1) {
            if (!matches(p)) return false;
        }

        return true;
    }, [entries]);

    return (
        <div>
            <KeyValueTable
                entries={entries}
                onAdd={handleAdd}
                onRemove={handleRemove}
                title="Scaling Rules"
                keyPlaceholder="Range (e.g. 85-100)"
                valuePlaceholder="GPA"
                validateValue={validateGPA}
                valueType="number"
                valueStep="0.1"
            />
            {entries.length > 0 && !isFullCoverage && (
                <div style={{ marginTop: '0.5rem', color: 'var(--color-warning, #f59e0b)', fontSize: '0.85rem' }}>
                    Warning: this table does not cover the full 0-100 range.
                </div>
            )}
        </div>
    );
};
