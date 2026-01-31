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
    const [displayText, setDisplayText] = useState(widget?.settings?.displayText || '');
    const [min, setMin] = useState(widget?.settings?.min ?? 0);
    const [max, setMax] = useState(widget?.settings?.max ?? 100);
    const [step, setStep] = useState(widget?.settings?.step ?? 1);
    const [initialValue, setInitialValue] = useState(widget?.settings?.initialValue ?? 0);

    // Update state when widget changes
    React.useEffect(() => {
        if (widget) {
            if (widget.type === 'counter') {
                setDisplayText(widget.settings?.displayText || '');
                setMin(widget.settings?.min ?? 0);
                setMax(widget.settings?.max ?? 100);
                setStep(widget.settings?.step ?? 1);
                setInitialValue(widget.settings?.initialValue ?? 0);
            }
        }
    }, [widget]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        const newSettings = {
            ...widget.settings,
            ...(widget.type === 'counter' ? {
                displayText,
                min: Number(min),
                max: Number(max),
                step: Number(step),
                initialValue: Number(initialValue)
            } : {})
        };

        await onSave(widget.id, {
            settings: JSON.stringify(newSettings)
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Widget Settings">
            <form onSubmit={handleSave}>
                {widget?.type === 'counter' && (
                    <>
                        <Input
                            label="Display Text"
                            value={displayText}
                            onChange={e => setDisplayText(e.target.value)}
                            placeholder="Enter custom text to display below counter"
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                            <Input
                                label="Min Value"
                                type="number"
                                value={min}
                                onChange={e => setMin(Number(e.target.value))}
                            />
                            <Input
                                label="Max Value"
                                type="number"
                                value={max}
                                onChange={e => setMax(Number(e.target.value))}
                            />
                            <Input
                                label="Step"
                                type="number"
                                value={step}
                                onChange={e => setStep(Number(e.target.value))}
                                min="1"
                            />
                            <Input
                                label="Initial Value"
                                type="number"
                                value={initialValue}
                                onChange={e => setInitialValue(Number(e.target.value))}
                            />
                        </div>
                    </>
                )}

                {!widget?.type && (
                    <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                        No settings available for this widget type.
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
