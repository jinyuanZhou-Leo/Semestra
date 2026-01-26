import React, { useState, useEffect } from 'react';
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

const GradeCalculatorPlugin: React.FC<WidgetProps> = ({ settings, updateSettings, courseId, updateCourseField }) => {
    const [assessments, setAssessments] = useState<Assessment[]>(settings.assessments || []);
    const [totalPercentage, setTotalPercentage] = useState(0);
    const [totalGrade, setTotalGrade] = useState(0);
    const [totalGradeScaled, setTotalGradeScaled] = useState<number | string>(0);
    const [scalingTable, setScalingTable] = useState<string>('{}');

    useEffect(() => {
        if (courseId) {
            fetchCourseData();
        }
    }, [courseId]);

    const fetchCourseData = async () => {
        if (!courseId) return;
        try {
            const course = await api.getCourse(courseId);
            setScalingTable(course.gpa_scaling_table || '{}');
        } catch (e) {
            console.error("Failed to fetch course data", e);
        }
    };

    useEffect(() => {
        calculateTotals();
    }, [assessments, scalingTable]);

    const calculateTotals = () => {
        let tp = 0;
        let weightedGradeSum = 0;

        assessments.forEach(a => {
            const p = typeof a.percentage === 'string' ? parseFloat(a.percentage) || 0 : a.percentage;
            const g = typeof a.grade === 'string' ? parseFloat(a.grade) || 0 : a.grade;

            tp += p;
            weightedGradeSum += (g * p / 100);
        });

        // Round to 2 decimals for display
        const tpRounded = Math.round(tp * 100) / 100;
        const tgRounded = Math.round(weightedGradeSum * 100) / 100;

        setTotalPercentage(tpRounded);
        setTotalGrade(tgRounded);

        const scaled = calculateGPA(tgRounded, scalingTable);
        setTotalGradeScaled(scaled);

        if (tpRounded === 100 && courseId) {
            // Optimistic UI: Local state is already updated.
            // API update is handled by the useEffect below with debounce.
        }
    };

    // Update course via context for reactive UI (debounced sync to backend handled by context)
    useEffect(() => {
        if (totalPercentage === 100 && courseId && updateCourseField) {
            // Update immediately via context for reactive UI
            updateCourseField('grade_percentage', totalGrade);
            updateCourseField('grade_scaled', typeof totalGradeScaled === 'number' ? totalGradeScaled : 0);
        }
    }, [totalPercentage, totalGrade, totalGradeScaled, courseId, updateCourseField]);

    const handleAddRow = () => {
        const newAssessment: Assessment = {
            id: Date.now().toString(),
            name: 'New Assessment',
            percentage: '',
            grade: ''
        };
        const newAssessments = [...assessments, newAssessment];
        setAssessments(newAssessments);
        updateSettings({ ...settings, assessments: newAssessments });
    };

    const handleRemoveRow = (id: string) => {
        const newAssessments = assessments.filter(a => a.id !== id);
        setAssessments(newAssessments);
        updateSettings({ ...settings, assessments: newAssessments });
    };

    const handleUpdateRow = (id: string, field: keyof Assessment, value: any) => {
        const newAssessments = assessments.map(a => {
            if (a.id === id) {
                return { ...a, [field]: value };
            }
            return a;
        });
        setAssessments(newAssessments);
        updateSettings({ ...settings, assessments: newAssessments });
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0.5rem' }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Name</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Weight (%)</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Grade</th>
                            <th style={{ width: '30px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {assessments.map(a => (
                            <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <td style={{ padding: '0.5rem', verticalAlign: 'middle' }}>
                                    <Input
                                        className="nodrag"
                                        value={a.name}
                                        onChange={e => handleUpdateRow(a.id, 'name', e.target.value)}
                                        style={{ width: '100%', marginBottom: 0 }}
                                        wrapperStyle={{ marginBottom: 0 }}
                                    />
                                </td>
                                <td style={{ padding: '0.5rem', verticalAlign: 'middle' }}>
                                    <Input
                                        className="nodrag"
                                        value={a.percentage}
                                        onChange={e => handleUpdateRow(a.id, 'percentage', e.target.value)}
                                        style={{ width: '100%', textAlign: 'right', marginBottom: 0 }}
                                        wrapperStyle={{ marginBottom: 0 }}
                                    />
                                </td>
                                <td style={{ padding: '0.5rem', verticalAlign: 'middle' }}>
                                    <Input
                                        className="nodrag"
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
                                        className="nodrag"
                                    >
                                        &times;
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ marginTop: '0.5rem', overflow: 'hidden' }}>
                    <Button onClick={handleAddRow} size="sm" variant="secondary" className="nodrag" style={{ width: '100%' }}>+ Add Assessment</Button>
                </div>
            </div>

            <div style={{ marginTop: 'auto' }}>


                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '0.5rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--color-border)'
                }}>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        backgroundColor: 'var(--color-bg-secondary)',
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Weight</div>
                        <div style={{
                            fontSize: '1.1rem',
                            fontWeight: 600,
                            color: totalPercentage !== 100 ? '#ef4444' : 'var(--color-text-primary)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            lineHeight: 1.2
                        }}>
                            {totalPercentage}%
                            {totalPercentage !== 100 && (
                                <span style={{ fontSize: '0.6rem', color: '#ef4444', textTransform: 'uppercase' }}>Invalid</span>
                            )}
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        backgroundColor: 'var(--color-bg-secondary)',
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grade</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {totalGrade}%
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        backgroundColor: 'var(--color-accent-primary)',
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--color-accent-text)'
                    }}>
                        <div style={{ fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent-text)' }}>GPA</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-accent-text)' }}>
                            {totalGradeScaled}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const GradeCalculatorPluginDefinition: WidgetDefinition = {
    type: 'grade-calculator',
    name: 'Grade Calculator',
    description: 'Calculate course grade based on assessment weights.',
    icon: '🧮',
    component: GradeCalculatorPlugin,
    defaultSettings: { assessments: [] },
    defaultLayout: { w: 4, h: 6, minW: 3, minH: 4 }
};
