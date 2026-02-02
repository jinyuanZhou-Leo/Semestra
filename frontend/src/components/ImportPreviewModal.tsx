import React, { useState, useMemo } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { RadioGroup } from './Radio';

export interface ProgramExport {
    name: string;
    cgpa_scaled: number;
    cgpa_percentage: number;
    gpa_scaling_table?: string;
    grad_requirement_credits: number;
    hide_gpa: boolean;
    semesters: SemesterExport[];
}

export interface SemesterExport {
    name: string;
    average_percentage: number;
    average_scaled: number;
    courses: CourseExport[];
    widgets: any[];
    tabs: any[];
}

export interface CourseExport {
    name: string;
    alias?: string;
    credits: number;
    grade_percentage: number;
    grade_scaled: number;
    include_in_gpa: boolean;
    hide_gpa: boolean;
    widgets: any[];
    tabs: any[];
}

export interface ImportData {
    version?: string;
    exported_at?: string;
    settings?: {
        nickname?: string;
        gpa_scaling_table?: string;
        default_course_credit?: number;
    };
    programs: ProgramExport[];
}

export type ConflictMode = 'skip' | 'overwrite' | 'rename';

interface ImportPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    importData: ImportData | null;
    existingProgramNames: string[];
    onConfirm: (mode: ConflictMode, includeSettings: boolean) => Promise<void>;
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
    isOpen,
    onClose,
    importData,
    existingProgramNames,
    onConfirm
}) => {
    const [conflictMode, setConflictMode] = useState<ConflictMode>('skip');
    const [includeSettings, setIncludeSettings] = useState(true);
    const [isImporting, setIsImporting] = useState(false);

    const analysis = useMemo(() => {
        if (!importData) return { newPrograms: [], conflictPrograms: [], totalSemesters: 0, totalCourses: 0 };

        const existingNamesLower = new Set(existingProgramNames.map(n => n.toLowerCase()));
        const newPrograms: string[] = [];
        const conflictPrograms: string[] = [];
        let totalSemesters = 0;
        let totalCourses = 0;

        for (const program of importData.programs) {
            if (existingNamesLower.has(program.name.toLowerCase())) {
                conflictPrograms.push(program.name);
            } else {
                newPrograms.push(program.name);
            }
            totalSemesters += program.semesters.length;
            for (const semester of program.semesters) {
                totalCourses += semester.courses.length;
            }
        }

        return { newPrograms, conflictPrograms, totalSemesters, totalCourses };
    }, [importData, existingProgramNames]);

    const handleConfirm = async () => {
        setIsImporting(true);
        try {
            await onConfirm(conflictMode, includeSettings);
            onClose();
        } catch (error) {
            console.error('Import failed:', error);
        } finally {
            setIsImporting(false);
        }
    };

    if (!importData) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="📤 Import Preview" maxWidth="550px">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Summary */}
                <div style={{
                    padding: '1rem',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.9rem'
                }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Import Summary</div>
                    <div style={{ color: 'var(--color-text-secondary)' }}>
                        {importData.programs.length} programs • {analysis.totalSemesters} semesters • {analysis.totalCourses} courses
                    </div>
                    {importData.exported_at && (
                        <div style={{ color: 'var(--color-text-tertiary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            Exported: {new Date(importData.exported_at).toLocaleString()}
                        </div>
                    )}
                </div>

                {/* Programs List */}
                <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>Programs</div>
                    <div style={{
                        maxHeight: '200px',
                        overflowY: 'auto',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        {analysis.newPrograms.map((name, i) => (
                            <div key={`new-${i}`} style={{
                                padding: '0.5rem 0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                borderBottom: '1px solid var(--color-border)',
                                fontSize: '0.9rem'
                            }}>
                                <span style={{ color: 'rgb(34, 197, 94)' }}>✓</span>
                                <span>{name}</span>
                                <span style={{
                                    marginLeft: 'auto',
                                    fontSize: '0.75rem',
                                    padding: '0.15rem 0.5rem',
                                    background: 'rgba(34, 197, 94, 0.15)',
                                    color: 'rgb(34, 197, 94)',
                                    borderRadius: '999px'
                                }}>new</span>
                            </div>
                        ))}
                        {analysis.conflictPrograms.map((name, i) => (
                            <div key={`conflict-${i}`} style={{
                                padding: '0.5rem 0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                borderBottom: '1px solid var(--color-border)',
                                fontSize: '0.9rem'
                            }}>
                                <span style={{ color: 'rgb(234, 179, 8)' }}>⚠️</span>
                                <span>{name}</span>
                                <span style={{
                                    marginLeft: 'auto',
                                    fontSize: '0.75rem',
                                    padding: '0.15rem 0.5rem',
                                    background: 'rgba(234, 179, 8, 0.15)',
                                    color: 'rgb(234, 179, 8)',
                                    borderRadius: '999px'
                                }}>exists</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Conflict Handling */}
                {analysis.conflictPrograms.length > 0 && (
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                            Conflict Handling ({analysis.conflictPrograms.length} conflicts)
                        </div>
                        <RadioGroup
                            value={conflictMode}
                            onChange={setConflictMode}
                            options={[
                                { value: 'skip', label: 'Skip', description: 'Keep existing, ignore imported' },
                                { value: 'overwrite', label: 'Overwrite', description: 'Replace existing with imported' },
                                { value: 'rename', label: 'Rename', description: 'Import as "Name (2)"' }
                            ]}
                        />
                    </div>
                )}

                {/* Settings Toggle */}
                {importData.settings && (
                    <Checkbox
                        checked={includeSettings}
                        onChange={setIncludeSettings}
                        label="Import user settings (nickname, default credit, GPA table)"
                    />
                )}

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <Button variant="secondary" onClick={onClose} disabled={isImporting}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={isImporting}>
                        {isImporting ? 'Importing...' : 'Confirm Import'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
