import React, { useEffect, useCallback, useMemo, useState } from 'react';
import type { WidgetDefinition, WidgetProps } from '../../services/widgetRegistry';
import { DEFAULT_GPA_SCALING_TABLE_JSON, calculateGPA } from '../../utils/gpaUtils';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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


    return (
        <div className="flex h-full flex-col gap-2 p-1 select-none text-xs">
            <div className="flex-1 overflow-auto rounded-md bg-card/50">
                <Table className="relative w-full text-xs">
                    <TableHeader className="sticky top-0 bg-secondary/80 backdrop-blur-sm z-10">
                        <TableRow className="h-8 hover:bg-transparent">
                            <TableHead className="h-8 pl-3 font-semibold text-foreground/80">Assessment</TableHead>
                            <TableHead className="h-8 text-right font-semibold text-foreground/80 w-[60px]">Wt(%)</TableHead>
                            <TableHead className="h-8 text-right font-semibold text-foreground/80 w-[60px]">Score</TableHead>
                            <TableHead className="h-8 w-8"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {assessments.map(a => (
                            <TableRow key={a.id} className="h-9 hover:bg-muted/30">
                                <TableCell className="p-0 pl-1">
                                    <Input
                                        value={a.name}
                                        onChange={e => handleUpdateRow(a.id, 'name', e.target.value)}
                                        placeholder="Name"
                                        className="h-7 border-0 bg-transparent px-2 text-xs focus-visible:ring-1 focus-visible:ring-ring/20 placeholder:text-muted-foreground/50"
                                    />
                                </TableCell>
                                <TableCell className="p-0">
                                    <Input
                                        value={a.percentage}
                                        onChange={e => handleUpdateRow(a.id, 'percentage', e.target.value)}
                                        inputMode="decimal"
                                        placeholder="0"
                                        className="h-7 border-0 bg-transparent text-right text-xs tabular-nums focus-visible:ring-1 focus-visible:ring-ring/20 pr-3 placeholder:text-muted-foreground/50"
                                    />
                                </TableCell>
                                <TableCell className="p-0">
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
                                        className="h-7 border-0 bg-transparent text-right text-xs tabular-nums focus-visible:ring-1 focus-visible:ring-ring/20 pr-3 placeholder:text-muted-foreground/50"
                                    />
                                </TableCell>
                                <TableCell className="p-0 text-center">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveRow(a.id)}
                                        className="h-6 w-6 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                                        aria-label="Remove"
                                    >
                                        &times;
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {assessments.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground/50 italic">
                                    No assessments added
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Button
                onClick={handleAddRow}
                size="sm"
                variant="outline"
                className="h-7 w-full border-dashed text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border"
            >
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
