import React, { useState } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';

interface WidgetSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    widget: any;
    onSave: (id: string, data: any) => Promise<void>;
}

export const WidgetSettingsModal: React.FC<WidgetSettingsModalProps> = ({
    isOpen,
    onClose,
    widget,
    onSave
}) => {
    const [title, setTitle] = useState(widget?.title || '');
    const [size, setSize] = useState(widget?.settings?.size || 'medium');
    const [min, setMin] = useState(widget?.settings?.min || 0);
    const [max, setMax] = useState(widget?.settings?.max || 10);

    // Update state when widget changes
    React.useEffect(() => {
        if (widget) {
            setTitle(widget.title);
            setSize(widget.settings?.size || 'medium');
            if (widget.type === 'counter') {
                setMin(widget.settings?.min ?? 0);
                setMax(widget.settings?.max ?? 10);
            }
        }
    }, [widget]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        const newSettings = {
            ...widget.settings,
            size: size,
            ...(widget.type === 'counter' ? { min, max } : {})
        };

        await onSave(widget.id, {
            title,
            settings: JSON.stringify(newSettings)
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Widget Settings">
            <form onSubmit={handleSave}>
                <Input
                    label="Title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                />

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Size</label>
                    <select
                        value={size}
                        onChange={e => setSize(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-bg-primary)',
                            color: 'var(--color-text-primary)'
                        }}
                    >
                        <option value="small">Small (1x1)</option>
                        <option value="medium">Medium (Fit Content)</option>
                        <option value="large">Large (2x2)</option>
                        <option value="wide">Wide (2x1)</option>
                    </select>
                </div>

                {widget?.type === 'counter' && (
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <Input
                                label="Min Value"
                                type="number"
                                value={min}
                                onChange={e => setMin(Number(e.target.value))}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <Input
                                label="Max Value"
                                type="number"
                                value={max}
                                onChange={e => setMax(Number(e.target.value))}
                            />
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit">Save</Button>
                </div>
            </form>
        </Modal>
    );
};
