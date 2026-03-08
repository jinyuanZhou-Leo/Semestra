// input:  [widget settings/update callbacks, course/program GPA lookup APIs, auth fallback scaling state, and shadcn table/form primitives]
// output: [grade-calculator widget component and widget definition]
// pos:    [course-scoped grade planning widget with inline-edit assessment rows and sortable weight/grade columns]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useEffect, useCallback, useMemo, useState } from 'react';
import type { WidgetDefinition, WidgetProps } from '../../services/widgetRegistry';
import { DEFAULT_GPA_SCALING_TABLE_JSON, calculateGPA } from '../../utils/gpaUtils';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDown, ArrowUp, ArrowUpDown, Trash2 } from 'lucide-react';

interface Assessment {
    id: string;
    name: string;
    percentage: number | string;
    grade: number | string;
}

type SortField = 'percentage' | 'grade' | null;
type SortDirection = 'asc' | 'desc';

const parseAssessmentNumber = (value: number | string): number => {
    if (typeof value === 'number') return value;
    return parseFloat(value) || 0;
};

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
    const assessments: Assessment[] = useMemo(
        () => (Array.isArray(settings.assessments) ? settings.assessments as Assessment[] : []),
        [settings.assessments]
    );
    const fallbackScalingTable = useMemo(
        () => user?.gpa_scaling_table || DEFAULT_GPA_SCALING_TABLE_JSON,
        [user?.gpa_scaling_table]
    );
    const [scalingTableJson, setScalingTableJson] = useState<string>(fallbackScalingTable);
    const [sortField, setSortField] = useState<SortField>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
                } catch (error) {
                    console.error('Failed to resolve scaling table', error);
                }
            }
            if (isActive) {
                setScalingTableJson(resolved);
            }
        };
        void resolveScalingTable();
        return () => {
            isActive = false;
        };
    }, [courseId, fallbackScalingTable]);

    const { totalPercentage, totalGrade, totalGradeScaled } = useMemo(() => {
        let nextTotalPercentage = 0;
        let weightedGradeSum = 0;

        assessments.forEach((assessment) => {
            const percentage = parseAssessmentNumber(assessment.percentage);
            const grade = parseAssessmentNumber(assessment.grade);

            nextTotalPercentage += percentage;
            weightedGradeSum += (grade * percentage / 100);
        });

        const roundedPercentage = Math.round(nextTotalPercentage * 100) / 100;
        const roundedGrade = Math.round(weightedGradeSum * 100) / 100;
        const scaled = calculateGPA(roundedGrade, scalingTableJson);

        return { totalPercentage: roundedPercentage, totalGrade: roundedGrade, totalGradeScaled: scaled };
    }, [assessments, scalingTableJson]);

    const sortedAssessments = useMemo(() => {
        if (!sortField) return assessments;

        const directionMultiplier = sortDirection === 'asc' ? 1 : -1;
        return [...assessments].sort((left, right) => {
            const leftValue = parseAssessmentNumber(left[sortField]);
            const rightValue = parseAssessmentNumber(right[sortField]);
            const numericDiff = (leftValue - rightValue) * directionMultiplier;

            if (numericDiff !== 0) {
                return numericDiff;
            }

            return left.name.localeCompare(right.name);
        });
    }, [assessments, sortDirection, sortField]);

    useEffect(() => {
        if (totalPercentage === 100 && courseId && updateCourse) {
            updateCourse({
                grade_percentage: totalGrade,
                grade_scaled: typeof totalGradeScaled === 'number' ? totalGradeScaled : 0,
            });
        }
    }, [totalPercentage, totalGrade, totalGradeScaled, courseId, updateCourse]);

    const handleAddRow = useCallback(() => {
        const newAssessment: Assessment = {
            id: Date.now().toString(),
            name: 'New Assessment',
            percentage: '',
            grade: '',
        };
        updateSettings({ ...settings, assessments: [...assessments, newAssessment] });
    }, [settings, assessments, updateSettings]);

    const handleRemoveRow = useCallback((id: string) => {
        updateSettings({ ...settings, assessments: assessments.filter((assessment) => assessment.id !== id) });
    }, [settings, assessments, updateSettings]);

    const handleUpdateRow = useCallback((id: string, field: keyof Assessment, value: string) => {
        const nextAssessments = assessments.map((assessment) => {
            if (assessment.id === id) {
                return { ...assessment, [field]: value };
            }
            return assessment;
        });
        updateSettings({ ...settings, assessments: nextAssessments });
    }, [settings, assessments, updateSettings]);

    const handleSort = useCallback((field: Exclude<SortField, null>) => {
        if (sortField === field) {
            if (sortDirection === 'desc') {
                setSortDirection('asc');
                return;
            }

            setSortField(null);
            setSortDirection('desc');
            return;
        }

        setSortField(field);
        setSortDirection('desc');
    }, [sortDirection, sortField]);

    const formatWeightSum = (weight: number): string => {
        if (weight > 100) return 'INV';
        if (weight >= 100) return '100';
        if (weight >= 10) return weight.toFixed(1);
        return weight.toFixed(2);
    };

    const getSortIcon = (field: Exclude<SortField, null>) => {
        if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/80" />;
        return sortDirection === 'desc'
            ? <ArrowDown className="h-3.5 w-3.5" />
            : <ArrowUp className="h-3.5 w-3.5" />;
    };

    return (
        <div className="flex h-full flex-col px-3 pb-3 pt-0">
            <div className="no-scrollbar flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <Table className="w-full border-collapse text-sm">
                    <TableHeader>
                        <TableRow className="h-auto border-b border-border hover:bg-transparent">
                            <TableHead className="p-2 text-left font-medium text-muted-foreground">Name</TableHead>
                            <TableHead className="w-[120px] p-2 text-right font-medium text-muted-foreground">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSort('percentage')}
                                    className="ml-auto h-8 gap-1 px-2"
                                >
                                    <span className={totalPercentage !== 100 ? 'text-destructive' : undefined}>
                                        Weight ({formatWeightSum(totalPercentage)}%)
                                    </span>
                                    {getSortIcon('percentage')}
                                </Button>
                            </TableHead>
                            <TableHead className="w-[108px] p-2 text-right font-medium text-muted-foreground">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSort('grade')}
                                    className="ml-auto h-8 gap-1 px-2"
                                >
                                    <span>Grade</span>
                                    {getSortIcon('grade')}
                                </Button>
                            </TableHead>
                            <TableHead className="w-[28px] p-1" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedAssessments.map((assessment) => (
                            <TableRow key={assessment.id} className="border-b border-border hover:bg-transparent">
                                <TableCell className="p-2 align-middle">
                                    <Input
                                        value={assessment.name}
                                        onChange={(event) => handleUpdateRow(assessment.id, 'name', event.target.value)}
                                        placeholder="Name"
                                        className="h-8 text-sm"
                                    />
                                </TableCell>
                                <TableCell className="p-2 align-middle">
                                    <Input
                                        value={assessment.percentage}
                                        onChange={(event) => handleUpdateRow(assessment.id, 'percentage', event.target.value)}
                                        inputMode="decimal"
                                        placeholder="0"
                                        className="h-8 text-right text-sm tabular-nums"
                                    />
                                </TableCell>
                                <TableCell className="p-2 align-middle">
                                    <Input
                                        value={assessment.grade}
                                        onChange={(event) => {
                                            let nextValue = event.target.value;
                                            const parsedValue = parseFloat(nextValue);
                                            if (!Number.isNaN(parsedValue) && parsedValue > 100) {
                                                nextValue = '100';
                                            }
                                            handleUpdateRow(assessment.id, 'grade', nextValue);
                                        }}
                                        inputMode="decimal"
                                        placeholder="0"
                                        className="h-8 text-right text-sm tabular-nums"
                                    />
                                </TableCell>
                                <TableCell className="p-1 text-center align-middle">
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => handleRemoveRow(assessment.id)}
                                        className="h-7 w-7 text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive"
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
    component: GradeCalculator,
    defaultSettings: { assessments: [] },
};
