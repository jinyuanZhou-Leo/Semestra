import React, { useEffect, useCallback, useMemo, useState } from 'react';
import type { WidgetDefinition, WidgetProps } from '../../services/widgetRegistry';
import { DEFAULT_GPA_SCALING_TABLE_JSON, calculateGPA } from '../../utils/gpaUtils';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2 } from 'lucide-react';

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
    const assessments: Assessment[] = useMemo(
        () => (Array.isArray(settings.assessments) ? settings.assessments as Assessment[] : []),
        [settings.assessments]
    );
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

    const formatWeightSum = (weight: number): string => {
        if (weight > 100) return 'INV';
        if (weight >= 100) return '100';
        if (weight >= 10) return weight.toFixed(1);
        return weight.toFixed(2);
    };


    return (
        <div className="flex h-full select-none flex-col p-2">
            <div className="no-scrollbar flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <Table className="w-full border-collapse text-sm">
                    <TableHeader>
                        <TableRow className="h-auto border-b border-border hover:bg-transparent">
                            <TableHead className="p-2 text-left font-medium text-muted-foreground">Name</TableHead>
                            <TableHead
                                className={`w-[108px] p-2 text-right font-medium ${
                                    totalPercentage !== 100 ? 'text-destructive' : 'text-muted-foreground'
                                }`}
                            >
                                <span className="inline-flex items-center justify-end">
                                    Weight(
                                    <span className="inline-block w-[3.4ch] text-center tabular-nums">
                                        {formatWeightSum(totalPercentage)}
                                    </span>
                                    %)
                                </span>
                            </TableHead>
                            <TableHead className="w-[96px] p-2 text-right font-medium text-muted-foreground">Grade</TableHead>
                            <TableHead className="w-[40px] p-2" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {assessments.map(a => (
                            <TableRow key={a.id} className="border-b border-border hover:bg-transparent">
                                <TableCell className="p-2 align-middle">
                                    <Input
                                        value={a.name}
                                        onChange={e => handleUpdateRow(a.id, 'name', e.target.value)}
                                        placeholder="Name"
                                        className="h-8 text-sm"
                                    />
                                </TableCell>
                                <TableCell className="p-2 align-middle">
                                    <Input
                                        value={a.percentage}
                                        onChange={e => handleUpdateRow(a.id, 'percentage', e.target.value)}
                                        inputMode="decimal"
                                        placeholder="0"
                                        className="h-8 text-right text-sm tabular-nums"
                                    />
                                </TableCell>
                                <TableCell className="p-2 align-middle">
                                    <Input
                                        value={a.grade}
                                        onChange={e => {
                                            let val = e.target.value;
                                            const num = parseFloat(val);
                                            if (!isNaN(num) && num > 100) val = '100';
                                            handleUpdateRow(a.id, 'grade', val);
                                        }}
                                        inputMode="decimal"
                                        placeholder="0"
                                        className="h-8 text-right text-sm tabular-nums"
                                    />
                                </TableCell>
                                <TableCell className="p-2 text-center align-middle">
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => handleRemoveRow(a.id)}
                                        className="text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive"
                                        aria-label="Remove"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {assessments.length === 0 && (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground/70 italic">
                                    No assessments added
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="mt-2 overflow-hidden">
                <Button
                    onClick={handleAddRow}
                    size="sm"
                    variant="secondary"
                    className="h-8 w-full"
                >
                    + Add Assessment
                </Button>
            </div>
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
