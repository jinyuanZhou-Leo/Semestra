import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import { GPAScalingTable } from './GPAScalingTable';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    initialName: string;
    initialSettings?: any; // e.g. credits, scaling table
    onSave: (data: any) => Promise<void>;
    type: 'program' | 'semester' | 'course';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    title,
    initialName,
    initialSettings = {},
    onSave,
    type
}) => {
    const [name, setName] = useState(initialName);
    const [extraSettings, setExtraSettings] = useState(initialSettings);
    const [jsonError, setJsonError] = useState('');
    const [gpaTableJson, setGpaTableJson] = useState('{}');

    useEffect(() => {
        if (isOpen) {
            setName(initialName);
            // Ensure boolean values are booleans
            setExtraSettings({
                ...initialSettings,
                include_in_gpa: initialSettings.include_in_gpa !== undefined ? initialSettings.include_in_gpa : true,
                hide_gpa: initialSettings.hide_gpa !== undefined ? initialSettings.hide_gpa : false
            });
            if (initialSettings.gpa_scaling_table) {
                setGpaTableJson(initialSettings.gpa_scaling_table);
            } else {
                setGpaTableJson('{}');
            }
        }
    }, [isOpen, initialName, initialSettings]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate JSON
        try {
            JSON.parse(gpaTableJson);
            setJsonError('');
        } catch (e) {
            setJsonError('Invalid JSON for GPA Table');
            return;
        }

        const data: any = { name };

        if (type === 'program' || type === 'course') {
            data.credits = parseFloat(extraSettings.credits || 0);
        }

        // Backend expects 'grad_requirement_credits' for Program, 'credits' for Course
        if (type === 'program') {
            data.grad_requirement_credits = parseFloat(extraSettings.grad_requirement_credits || 0);
            data.hide_gpa = extraSettings.hide_gpa;
        } else if (type === 'course') {
            data.credits = parseFloat(extraSettings.credits || 0);
            data.include_in_gpa = extraSettings.include_in_gpa;
            data.hide_gpa = extraSettings.hide_gpa;
        }

        data.gpa_scaling_table = gpaTableJson;

        await onSave(data);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <form onSubmit={handleSave}>
                <Input
                    label="Name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                />

                {type === 'program' && (
                    <>
                        <Input
                            label="Graduation Requirement (Credits)"
                            type="number"
                            step="0.5"
                            value={extraSettings.grad_requirement_credits || ''}
                            onChange={e => setExtraSettings({ ...extraSettings, grad_requirement_credits: e.target.value })}
                            required
                        />
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={extraSettings.hide_gpa ?? false}
                                    onChange={e => setExtraSettings({ ...extraSettings, hide_gpa: e.target.checked })}
                                />
                                Hide GPA Info
                            </label>
                        </div>
                    </>
                )}

                {type === 'course' && (
                    <>
                        <Input
                            label="Credits"
                            type="number"
                            step="0.5"
                            value={extraSettings.credits || ''}
                            onChange={e => setExtraSettings({ ...extraSettings, credits: e.target.value })}
                            required
                        />
                        <div style={{ marginBottom: '1rem', display: 'flex', gap: '1.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={extraSettings.include_in_gpa ?? true}
                                    onChange={e => setExtraSettings({ ...extraSettings, include_in_gpa: e.target.checked })}
                                />
                                Include in GPA
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={extraSettings.hide_gpa ?? false}
                                    onChange={e => setExtraSettings({ ...extraSettings, hide_gpa: e.target.checked })}
                                />
                                Hide GPA Info
                            </label>
                        </div>
                    </>
                )}

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                        GPA Scaling Table
                    </label>
                    <GPAScalingTable
                        value={gpaTableJson}
                        onChange={(newValue) => {
                            setGpaTableJson(newValue);
                            setJsonError('');
                        }}
                    />
                    {jsonError && <div style={{ color: 'red', fontSize: '0.8rem', marginTop: '0.25rem' }}>{jsonError}</div>}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit">
                        Save Changes
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
