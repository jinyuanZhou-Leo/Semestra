import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils'; // Keep usage of cn for potential future flexibility

export interface KeyValueEntry {
    key: string;
    value: string;
}

interface KeyValueTableProps {
    entries: KeyValueEntry[];
    onAdd: (key: string, value: string) => void;
    onRemove: (key: string) => void;
    title?: string;
    keyLabel?: string;
    valueLabel?: string;
    keyPlaceholder?: string;
    valuePlaceholder?: string;
    validateKey?: (key: string) => string | null; // Returns error message or null
    validateValue?: (value: string) => string | null; // Returns error message or null
    keyType?: React.HTMLInputTypeAttribute;
    valueType?: React.HTMLInputTypeAttribute;
    valueStep?: string | number;
}

export const KeyValueTable: React.FC<KeyValueTableProps> = ({
    entries,
    onAdd,
    onRemove,
    title = "Entries",
    keyLabel,
    valueLabel,
    keyPlaceholder = "Key",
    valuePlaceholder = "Value",
    validateKey,
    validateValue,
    keyType = "text",
    valueType = "text",
    valueStep
}) => {
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [error, setError] = useState('');

    const handleAdd = () => {
        setError('');

        if (!newKey.trim() || !newValue.trim()) {
            setError('Both fields are required');
            return;
        }

        if (validateKey) {
            const err = validateKey(newKey.trim());
            if (err) {
                setError(err);
                return;
            }
        }

        if (validateValue) {
            const err = validateValue(newValue.trim());
            if (err) {
                setError(err);
                return;
            }
        }

        // Check for duplicates in current list
        if (entries.some(e => e.key === newKey.trim())) {
            setError('Entry with this key already exists');
            return;
        }

        onAdd(newKey.trim(), newValue.trim());
        setNewKey('');
        setNewValue('');
    };

    return (
        <div className="rounded-md border p-4 bg-muted/40">
            <h4 className="mb-4 text-sm font-medium text-muted-foreground">
                {title}
            </h4>

            {entries.length > 0 ? (
                <div className="mb-4 flex flex-col gap-2">
                    {entries.map((entry) => (
                        <div key={entry.key} className="flex items-center justify-between rounded-md border bg-background px-4 py-3 shadow-sm">
                            <div className="flex gap-4 items-center overflow-hidden">
                                <span className="font-medium min-w-[80px]">{entry.key}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-semibold">{entry.value}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                type="button" // Prevent form submission
                                onClick={() => onRemove(entry.key)}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            ) : (
                    <div className="text-center text-sm text-muted-foreground mb-4">
                    No entries defined.
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                    <div className="flex flex-col gap-2">
                        {keyLabel && <Label className="text-muted-foreground">{keyLabel}</Label>}
                        <Input
                            placeholder={keyPlaceholder}
                            value={newKey}
                            onChange={e => setNewKey(e.target.value)}
                            type={keyType}
                        />
                    </div>
                </div>
                <div className="flex-1 w-full">
                    <div className="flex flex-col gap-2">
                        {valueLabel && <Label className="text-muted-foreground">{valueLabel}</Label>}
                        <Input
                            placeholder={valuePlaceholder}
                            value={newValue}
                            onChange={e => setNewValue(e.target.value)}
                            type={valueType}
                            step={valueStep}
                        />
                    </div>
                </div>
                <div className="sm:w-auto w-full">
                    <Button onClick={handleAdd} disabled={!newKey || !newValue} type="button" className="w-full sm:w-auto">
                        Add
                    </Button>
                </div>
            </div>
            {error && <div className="text-xs text-destructive mt-2">{error}</div>}
        </div>
    );
};
