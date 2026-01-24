import React, { useState, useEffect } from 'react';
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

    return (
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
    );
};
