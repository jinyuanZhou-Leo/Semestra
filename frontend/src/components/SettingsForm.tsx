import React, { useEffect, useMemo, useState } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { GPAScalingTable } from './GPAScalingTable';

interface SettingsFormProps {
    initialName: string;
    initialSettings?: any;
    onSave: (data: any) => Promise<void>;
    type: 'program' | 'semester' | 'course';
    submitLabel?: string;
    showCancel?: boolean;
    onCancel?: () => void;
}

export const SettingsForm: React.FC<SettingsFormProps> = ({
    initialName,
    initialSettings = {},
    onSave,
    type,
    submitLabel = 'Save Changes',
    showCancel = false,
    onCancel
}) => {
    const [name, setName] = useState(initialName);
    const [extraSettings, setExtraSettings] = useState(initialSettings);
    const [jsonError, setJsonError] = useState('');
    const [gpaTableJson, setGpaTableJson] = useState('{}');

    const settingsKey = useMemo(() => JSON.stringify(initialSettings ?? {}), [initialSettings]);

    useEffect(() => {
        setName(initialName);
        setExtraSettings({
            ...initialSettings,
            include_in_gpa: initialSettings.include_in_gpa !== undefined ? initialSettings.include_in_gpa : true,
            hide_gpa: initialSettings.hide_gpa !== undefined ? initialSettings.hide_gpa : false
        });
        if (type === 'program' && initialSettings.gpa_scaling_table) {
            setGpaTableJson(initialSettings.gpa_scaling_table);
        } else {
            setGpaTableJson('{}');
        }
        setJsonError('');
    }, [initialName, settingsKey, type]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (type === 'program') {
            try {
                JSON.parse(gpaTableJson);
                setJsonError('');
            } catch (e) {
                setJsonError('Invalid JSON for GPA Table');
                return;
            }
        }

        const data: any = { name };

        if (type === 'program' || type === 'course') {
            data.credits = parseFloat(extraSettings.credits || 0);
        }

        if (type === 'program') {
            data.grad_requirement_credits = parseFloat(extraSettings.grad_requirement_credits || 0);
            data.hide_gpa = extraSettings.hide_gpa;
        } else if (type === 'course') {
            data.credits = parseFloat(extraSettings.credits || 0);
            data.include_in_gpa = extraSettings.include_in_gpa;
            data.hide_gpa = extraSettings.hide_gpa;
        }

        if (type === 'program') {
            data.gpa_scaling_table = gpaTableJson;
        }

        await onSave(data);
    };

    return (
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
                        <Checkbox
                            checked={extraSettings.hide_gpa ?? false}
                            onChange={checked => setExtraSettings({ ...extraSettings, hide_gpa: checked })}
                            label="Hide GPA Info"
                        />
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
                        <Checkbox
                            checked={extraSettings.include_in_gpa ?? true}
                            onChange={checked => setExtraSettings({ ...extraSettings, include_in_gpa: checked })}
                            label="Include in GPA"
                        />

                        <Checkbox
                            checked={extraSettings.hide_gpa ?? false}
                            onChange={checked => setExtraSettings({ ...extraSettings, hide_gpa: checked })}
                            label="Hide GPA Info"
                        />
                    </div>
                </>
            )}

            {type === 'program' && (
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
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                {showCancel && (
                    <Button type="button" variant="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
                <Button type="submit">
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
};
