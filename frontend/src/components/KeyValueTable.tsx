import React, { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';

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
        <div style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            backgroundColor: 'var(--color-bg-secondary)'
        }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                {title}
            </h4>

            {entries.length > 0 ? (
                <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {entries.map((entry) => (
                        <div key={entry.key} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--color-bg-primary)',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)'
                        }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', overflow: 'hidden' }}>
                                <span style={{ fontWeight: 500, minWidth: '80px' }}>{entry.key}</span>
                                <span style={{ color: 'var(--color-text-secondary)' }}>→</span>
                                <span style={{ fontWeight: 600 }}>{entry.value}</span>
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                type="button" // Prevent form submission
                                onClick={() => onRemove(entry.key)}
                                style={{ color: 'var(--color-error)' }}
                            >
                                ×
                            </Button>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    No entries defined.
                </div>
            )}

            <div className="kv-input-row">
                <div className="kv-input-key">
                    <Input
                        placeholder={keyPlaceholder}
                        value={newKey}
                        onChange={e => setNewKey(e.target.value)}
                        style={{ marginBottom: 0 }}
                        label={keyLabel}
                        type={keyType}
                    />
                </div>
                <div className="kv-input-value">
                    <Input
                        placeholder={valuePlaceholder}
                        value={newValue}
                        onChange={e => setNewValue(e.target.value)}
                        type={valueType}
                        step={valueStep}
                        style={{ marginBottom: 0 }}
                    />
                </div>
                <div className="kv-input-action">
                    <Button onClick={handleAdd} disabled={!newKey || !newValue} type="button">
                        Add
                    </Button>
                </div>
            </div>
            {error && <div style={{ color: 'var(--color-error)', fontSize: '0.8rem', marginTop: '0.5rem', width: '100%' }}>{error}</div>}
        </div>
    );
};
