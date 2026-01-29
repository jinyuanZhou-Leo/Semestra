import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import type { WidgetDefinition, WidgetProps } from '../../services/widgetRegistry';
import { DEFAULT_GPA_SCALING_TABLE_JSON, calculateGPA } from '../../utils/gpaUtils';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface Assessment {
    id: string;
    name: string;
    percentage: number | string;
    grade: number | string;
}

/**
 * GradeCalculator Plugin
 * 
 * SIMPLIFIED IMPLEMENTATION:
 * - Framework handles debouncing automatically via updateSettings
 * - Plugin just calls updateSettings, framework does Optimistic UI + debounced API sync
 * - No need for internal debouncing logic
 */
const GradeCalculatorComponent: React.FC<WidgetProps> = ({ settings, updateSettings, courseId, updateCourseField }) => {
    const { user } = useAuth();
    // Use settings directly - framework handles Optimistic UI
    const assessments: Assessment[] = settings.assessments || [];
    const fallbackScalingTable = useMemo(
        () => user?.gpa_scaling_table || DEFAULT_GPA_SCALING_TABLE_JSON,
        [user?.gpa_scaling_table]
    );
    const [scalingTableJson, setScalingTableJson] = useState<string>(fallbackScalingTable);

    useEffect(() => {
        let isActive = true;
        const resolveScalingTable = async () => {
            let resolved = fallbackScalingTable;
            if (courseId) {
                try {
                    const course = await api.getCourse(courseId);
                    if (course.semester_id) {
                        const semester = await api.getSemester(course.semester_id);
                        if (semester.program_id) {
                            const program = await api.getProgram(semester.program_id);
                            if (program.gpa_scaling_table && program.gpa_scaling_table !== '{}') {
                                resolved = program.gpa_scaling_table;
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to resolve scaling table", e);
                }
            }
            if (isActive) {
                setScalingTableJson(resolved);
            }
        };
        resolveScalingTable();
        return () => {
            isActive = false;
        };
    }, [courseId, fallbackScalingTable]);

    // Calculate totals from assessments
    const { totalPercentage, totalGrade, totalGradeScaled } = useMemo(() => {
        let tp = 0;
        let weightedGradeSum = 0;

        assessments.forEach(a => {
            const p = typeof a.percentage === 'string' ? parseFloat(a.percentage) || 0 : a.percentage;
            const g = typeof a.grade === 'string' ? parseFloat(a.grade) || 0 : a.grade;

            tp += p;
            weightedGradeSum += (g * p / 100);
        });

        const tpRounded = Math.round(tp * 100) / 100;
        const tgRounded = Math.round(weightedGradeSum * 100) / 100;
        const scaled = calculateGPA(tgRounded, scalingTableJson);
        return { totalPercentage: tpRounded, totalGrade: tgRounded, totalGradeScaled: scaled };
    }, [assessments, scalingTableJson]);

    // Update course via context for reactive UI
    useEffect(() => {
        if (totalPercentage === 100 && courseId && updateCourseField) {
            updateCourseField('grade_percentage', totalGrade);
            updateCourseField('grade_scaled', typeof totalGradeScaled === 'number' ? totalGradeScaled : 0);
        }
    }, [totalPercentage, totalGrade, totalGradeScaled, courseId, updateCourseField]);

    // Simple handlers - just call updateSettings, framework handles debouncing
    const handleAddRow = useCallback(() => {
        const newAssessment: Assessment = {
            id: Date.now().toString(),
            name: 'New Assessment',
            percentage: '',
            grade: ''
        };
        updateSettings({ ...settings, assessments: [...assessments, newAssessment] });
    }, [settings, assessments, updateSettings]);

    const handleRemoveRow = useCallback((id: string) => {
        updateSettings({ ...settings, assessments: assessments.filter(a => a.id !== id) });
    }, [settings, assessments, updateSettings]);

    const handleUpdateRow = useCallback((id: string, field: keyof Assessment, value: any) => {
        const newAssessments = assessments.map(a => {
            if (a.id === id) {
                return { ...a, [field]: value };
            }
            return a;
        });
        updateSettings({ ...settings, assessments: newAssessments });
    }, [settings, assessments, updateSettings]);

    // Format weight sum to always show 3 digits
    const formatWeightSum = (weight: number): string => {
        if (weight > 100) return 'INV';
        if (weight >= 100) return '100';
        if (weight >= 10) return weight.toFixed(1);
        return weight.toFixed(2);
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0.5rem', userSelect: 'none' }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Name</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem', color: totalPercentage !== 100 ? '#ef4444' : 'var(--color-text-secondary)', fontWeight: 500 }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                    Weight(
                                    <span style={{
                                        display: 'inline-block',
                                        width: '3.4ch',
                                        textAlign: 'center',
                                        fontVariantNumeric: 'tabular-nums'
                                    }}>
                                        {formatWeightSum(totalPercentage)}
                                    </span>
                                    %)
                                </div>
                            </th>
                            <th style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Grade</th>
                            <th style={{ width: '30px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {assessments.map(a => (
                            <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <td style={{ padding: '0.5rem', verticalAlign: 'middle' }}>
                                    <Input
                                        value={a.name}
                                        onChange={e => handleUpdateRow(a.id, 'name', e.target.value)}
                                        style={{ width: '100%', marginBottom: 0 }}
                                        wrapperStyle={{ marginBottom: 0 }}
                                    />
                                </td>
                                <td style={{ padding: '0.5rem', verticalAlign: 'middle' }}>
                                    <Input
                                        value={a.percentage}
                                        onChange={e => handleUpdateRow(a.id, 'percentage', e.target.value)}
                                        style={{ width: '100%', textAlign: 'right', marginBottom: 0 }}
                                        wrapperStyle={{ marginBottom: 0 }}
                                    />
                                </td>
                                <td style={{ padding: '0.5rem', verticalAlign: 'middle' }}>
                                    <Input
                                        value={a.grade}
                                        onChange={e => {
                                            let val = e.target.value;
                                            const num = parseFloat(val);
                                            if (!isNaN(num) && num > 100) {
                                                val = '100';
                                            }
                                            handleUpdateRow(a.id, 'grade', val);
                                        }}
                                        style={{ width: '100%', textAlign: 'right', marginBottom: 0 }}
                                        wrapperStyle={{ marginBottom: 0 }}
                                    />
                                </td>
                                <td style={{ padding: '0.5rem', verticalAlign: 'middle', textAlign: 'center' }}>
                                    <Button
                                        variant="secondary"
                                        onClick={() => handleRemoveRow(a.id)}
                                        style={{ padding: '0.25rem 0.5rem', color: '#ef4444', minWidth: 'unset' }}
                                    >
                                        &times;
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ marginTop: '0.5rem', overflow: 'hidden' }}>
                    <Button onClick={handleAddRow} size="sm" variant="secondary" style={{ width: '100%' }}>+ Add Assessment</Button>
                </div>
            </div>

            {/* Footer removed as per request */}
        </div>
    );
};

// Memoize to prevent re-renders when parent updates unrelated state
export const GradeCalculator = React.memo(GradeCalculatorComponent);

export const GradeCalculatorDefinition: WidgetDefinition = {
    type: 'grade-calculator',
    name: 'Grade Calculator',
    description: 'Calculate course grade based on assessment weights.',
    icon: '🧮',
    component: GradeCalculator,
    maxInstances: 1,
    allowedContexts: ['course'],
    defaultSettings: { assessments: [] },
    layout: { w: 4, h: 5, minW: 4, minH: 3, maxW: 6, maxH: 6 }
};
