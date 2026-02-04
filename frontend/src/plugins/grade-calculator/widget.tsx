import React, { useEffect, useCallback, useMemo, useState } from 'react';
import type { WidgetDefinition, WidgetProps } from '../../services/widgetRegistry';
import { DEFAULT_GPA_SCALING_TABLE_JSON, calculateGPA } from '../../utils/gpaUtils';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
const GradeCalculatorComponent: React.FC<WidgetProps> = ({ settings, updateSettings, courseId, updateCourse }) => {
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
        if (totalPercentage === 100 && courseId && updateCourse) {
            updateCourse({
                grade_percentage: totalGrade,
                grade_scaled: typeof totalGradeScaled === 'number' ? totalGradeScaled : 0
            });
        }
    }, [totalPercentage, totalGrade, totalGradeScaled, courseId, updateCourse]);

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
        <div className="flex h-full flex-col gap-2 p-2 select-none">
            <div className="flex-1 overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-right">
                                <span className="inline-flex items-center justify-end gap-2">
                                    Weight
                                    <Badge
                                        variant={totalPercentage === 100 ? "secondary" : "destructive"}
                                        className="px-1.5 py-0.5 text-[10px] tabular-nums"
                                    >
                                        {formatWeightSum(totalPercentage)}%
                                    </Badge>
                                </span>
                            </TableHead>
                            <TableHead className="text-right">Grade</TableHead>
                            <TableHead className="w-10 text-right"> </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {assessments.map(a => (
                            <TableRow key={a.id}>
                                <TableCell>
                                    <Input
                                        value={a.name}
                                        onChange={e => handleUpdateRow(a.id, 'name', e.target.value)}
                                        placeholder="Assessment name"
                                        className="h-9"
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Input
                                        value={a.percentage}
                                        onChange={e => handleUpdateRow(a.id, 'percentage', e.target.value)}
                                        inputMode="decimal"
                                        placeholder="0"
                                        className="h-9 text-right tabular-nums"
                                    />
                                </TableCell>
                                <TableCell className="text-right">
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
                                        inputMode="decimal"
                                        placeholder="0"
                                        className="h-9 text-right tabular-nums"
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveRow(a.id)}
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        aria-label="Remove assessment"
                                    >
                                        &times;
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <Separator />
            <Button onClick={handleAddRow} size="sm" variant="secondary" className="w-full">
                + Add Assessment
            </Button>
        </div>
    );
};

export const GradeCalculator = GradeCalculatorComponent;

export const GradeCalculatorDefinition: WidgetDefinition = {
    type: 'grade-calculator',
    name: 'Grade Calculator',
    description: 'Calculate course grade based on assessment weights.',
    icon: '🧮',
    component: GradeCalculator,
    maxInstances: 1,
    allowedContexts: ['course'],
    defaultSettings: { assessments: [] },
    layout: { w: 4, h: 3, minW: 2, minH: 2, maxW: 6, maxH: 6 }
};
