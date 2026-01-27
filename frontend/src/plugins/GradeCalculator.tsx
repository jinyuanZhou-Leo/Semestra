import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import api from '../services/api';
import type { WidgetDefinition, WidgetProps } from '../services/widgetRegistry';
import { calculateGPA } from '../utils/gpaUtils';

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
    // Use settings directly - framework handles Optimistic UI
    const assessments: Assessment[] = settings.assessments || [];

    const [scalingTable, setScalingTable] = useState<string>('{}');

    // Memoize fetchCourseData
    const fetchCourseData = useCallback(async () => {
        if (!courseId) return;
        try {
            const course = await api.getCourse(courseId);
            setScalingTable(course.gpa_scaling_table || '{}');
        } catch (e) {
            console.error("Failed to fetch course data", e);
        }
    }, [courseId]);

    useEffect(() => {
        if (courseId) {
            fetchCourseData();
        }
    }, [courseId, fetchCourseData]);

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
        const scaled = calculateGPA(tgRounded, scalingTable);

        return { totalPercentage: tpRounded, totalGrade: tgRounded, totalGradeScaled: scaled };
    }, [assessments, scalingTable]);

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
    defaultSettings: { assessments: [] },
    defaultLayout: { w: 4, h: 6, minW: 3, minH: 4 }
};
