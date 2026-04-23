// input:  [program context state, Program Home Focus Board persistence, semester/course CRUD APIs, Program subject-color settings, Program LMS integrations/courses, dedicated Program settings routing, standalone Semester wizard routing, course-manager modal flows, shared GPA-percentage formatting, shared business empty-state wrappers, shared DataTable row-action patterns, page-scoped global-command actions, and shadcn AlertDialog/menu/Combobox interactions]
// output: [`ProgramHomePage` route component for the Program workspace]
// pos:    [Program-level home workspace page that keeps overview stats prominent, adds a Program Home Focus Board for pinned Semesters/Courses with drag-and-drop persistence, and refreshes unassigned Program courses through one shared data path]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AppEmptyState } from '../components/AppEmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Container } from '../components/Container';
import { DataTable, DataTableActionMenu, type ColumnDef } from '../components/DataTable';
import api, { type Course, type Semester } from '../services/api';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCardSkeleton, SemesterCardSkeleton, TextSkeleton } from '../components/skeletons';
import { ProgramDataProvider, useProgramData } from '../contexts/ProgramDataContext';
import { CourseManagerModal } from '../components/CourseManagerModal';
import { useDialog } from '../contexts/DialogContext';
import { useAuth } from '../contexts/AuthContext';
import { formatGpaPercentage, formatGpaPercentageValue } from '@/utils/percentage';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from '@/components/ui/input-group';
import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxGroup,
    ComboboxItem,
    ComboboxLabel,
    ComboboxList,
    ComboboxValue,
    useComboboxAnchor,
} from '@/components/ui/combobox';
import { Settings, Plus, Search, Trash2, GraduationCap, Percent, BookOpen, Eye, EyeOff, Tag, Calendar, Hash, TrendingUp, Layers } from 'lucide-react';
import { getCourseBadgeStyle, getCourseCategoryBadgeClassName, parseSubjectColorMap, resolveCourseColor, resolveCourseSubjectCode, resolveSubjectColorAssignments } from '@/utils/courseCategoryBadge';
import { CreateSemesterWizardButton } from './program-dashboard/CreateSemesterWizardButton';
import { DeleteSemesterButton } from './program-dashboard/DeleteSemesterButton';
import { ProgramFocusBoard } from './program-dashboard/ProgramFocusBoard';
import type { LayoutCommandGroup } from '../components/GlobalCommandPalette';
import {
    PROGRAM_HOME_TAB_TYPE,
    parseProgramHomeSettings,
    replaceProgramHomeTabSetting,
    serializeProgramHomeSettings,
    type ProgramHomeSettings,
} from '@/utils/programHome';

// Helper function to extract course level from course name
const extractCourseLevel = (courseName: string): number | null => {
    // Match patterns like "CS 101", "MAT180", "MAT 180", "MAT-180", "MATH180", etc.
    // Look for 3-4 digit course numbers where the first digit is 1-5
    const match = courseName.match(/([1-5])(\d{2,3})(?!\d)/);
    if (match) {
        const level = parseInt(match[1], 10);
        return level * 100; // Return 100, 200, 300, 400, or 500
    }
    return null;
};

type CourseWithProgramContext = Course & { semesterName: string; semesterId: string; semesterStartDate?: string | null };
type CourseFilterSuggestion = {
    type: string;
    value: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
};
type IndexedCourseWithProgramContext = CourseWithProgramContext & {
    courseLevel: number | null;
    normalizedName: string;
    normalizedAlias: string;
    normalizedCategory: string;
    subjectCode: string | null;
};

const COURSE_FILTER_GROUP_LABELS: Record<string, string> = {
    category: 'Categories',
    semester: 'Semesters',
    credits: 'Credits',
    level: 'Levels',
    gpa: 'GPA',
};

const COURSE_PAGE_SIZE = 10;

type ShowAlert = (options: { title: string; description: string }) => Promise<void>;
type VisibleSemester = Semester & { courses?: Course[] };

type SemestersSectionProps = {
    semesters: VisibleSemester[];
    programId: string;
    hideGpa: boolean;
    onRefresh: () => Promise<void>;
    showAlert: ShowAlert;
};

const SemestersSection: React.FC<SemestersSectionProps> = ({
    semesters,
    programId,
    hideGpa,
    onRefresh,
    showAlert,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const normalizedQuery = useMemo(
        () => deferredSearchQuery.trim().toLowerCase(),
        [deferredSearchQuery],
    );

    const filteredSemesters = useMemo(() => {
        if (!normalizedQuery) {
            return semesters;
        }
        return semesters.filter((semester) => semester.name.toLowerCase().includes(normalizedQuery));
    }, [normalizedQuery, semesters]);

    return (
        <section className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-lg font-semibold tracking-tight">
                    Semesters
                </h2>
                <div className="flex-1 max-w-sm space-y-1.5">
                    <InputGroup>
                        <InputGroupAddon>
                            <Search className="pointer-events-none size-4 text-muted-foreground" />
                        </InputGroupAddon>
                        <InputGroupInput
                            placeholder="Search semesters..."
                            value={searchQuery}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                        />
                    </InputGroup>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {filteredSemesters.map((semester) => (
                    <div key={semester.id} className="group relative">
                        <Link to={`/semesters/${semester.id}`} className="block h-full">
                            <Card className="h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md">
                                <CardHeader className="pb-1">
                                    <CardTitle className="truncate pr-8 text-base font-semibold">
                                        {semester.name}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-2">
                                    <div className="mt-1 grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-xs tracking-wider text-muted-foreground font-medium">GPA</p>
                                            <p className={`text-base font-semibold ${!hideGpa && (semester.average_scaled >= 3.0 ? 'text-emerald-600' : 'text-amber-600')}`}>
                                                {hideGpa ? '****' : (
                                                    <AnimatedNumber
                                                        value={semester.average_scaled}
                                                        format={(val) => val.toFixed(2)}
                                                    />
                                                )}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs tracking-wider text-muted-foreground font-medium">Average</p>
                                            <p className="text-base font-semibold">{hideGpa ? '****' : formatGpaPercentage(semester.average_percentage)}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
                                        <span>{semester.courses?.length || 0} Courses</span>
                                        <div
                                            className={`h-2 w-2 rounded-full ${semester.average_scaled >= 3.0 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                        <div className="absolute right-4 top-4">
                            <DeleteSemesterButton
                                semesterId={semester.id}
                                semesterName={semester.name}
                                onDeleted={onRefresh}
                                showAlert={showAlert}
                            />
                        </div>
                    </div>
                ))}
                {filteredSemesters.length === 0 && (
                    <AppEmptyState
                        scenario="create"
                        size="section"
                        className="col-span-full"
                        title="No semesters yet"
                        description="Create your first semester to start organizing courses and schedules."
                        primaryAction={(
                            <CreateSemesterWizardButton
                                programId={programId}
                                onChanged={onRefresh}
                            >
                                Create Semester
                            </CreateSemesterWizardButton>
                        )}
                    />
                )}
            </div>
        </section>
    );
};

type AllCoursesSectionProps = {
    programCourses: CourseWithProgramContext[];
    subjectColorMap: Record<string, string>;
    onOpenCourseModal: () => void;
    onRefresh: () => Promise<void>;
    showAlert: ShowAlert;
};

const AllCoursesSection: React.FC<AllCoursesSectionProps> = ({
    programCourses,
    subjectColorMap,
    onOpenCourseModal,
    onRefresh,
    showAlert,
}) => {
    const [coursePendingDelete, setCoursePendingDelete] = useState<CourseWithProgramContext | null>(null);
    const [isDeletingCourse, setIsDeletingCourse] = useState(false);
    const [courseSearchQuery, setCourseSearchQuery] = useState('');
    const [activeFilters, setActiveFilters] = useState<CourseFilterSuggestion[]>([]);
    const suggestionsAnchor = useComboboxAnchor();
    const deferredCourseSearchQuery = useDeferredValue(courseSearchQuery);

    const allCoursesIndex = useMemo(() => {
        const categories = new Set<string>();
        const semesters = new Set<string>();
        const credits = new Set<number>();
        const levels = new Set<number>();
        const subjectCodes = new Set<string>();

        const indexedCourses: IndexedCourseWithProgramContext[] = programCourses.map((course) => {
            const normalizedCategory = course.category?.toLowerCase() ?? '';
            const courseLevel = extractCourseLevel(course.name);
            const subjectCode = resolveCourseSubjectCode(course);

            if (course.category) {
                categories.add(course.category);
            }
            semesters.add(course.semesterName);
            credits.add(course.credits ?? 0);
            if (courseLevel !== null) {
                levels.add(courseLevel);
            }
            if (subjectCode) {
                subjectCodes.add(subjectCode);
            }

            return {
                ...course,
                courseLevel,
                normalizedName: course.name.toLowerCase(),
                normalizedAlias: course.alias?.toLowerCase() ?? '',
                normalizedCategory,
                subjectCode,
            };
        });

        const groupedSuggestionsMap = new Map<string, Array<CourseFilterSuggestion>>();
        const pushSuggestion = (suggestion: CourseFilterSuggestion) => {
            const groupSuggestions = groupedSuggestionsMap.get(suggestion.type);
            if (groupSuggestions) {
                groupSuggestions.push(suggestion);
                return;
            }
            groupedSuggestionsMap.set(suggestion.type, [suggestion]);
        };

        Array.from(categories)
            .sort((left, right) => left.localeCompare(right))
            .forEach((category) => {
                pushSuggestion({
                    type: 'category',
                    value: category,
                    label: `Category: ${category}`,
                    icon: Tag,
                });
            });

        Array.from(semesters)
            .sort((left, right) => left.localeCompare(right))
            .forEach((semester) => {
                pushSuggestion({
                    type: 'semester',
                    value: semester,
                    label: `Semester: ${semester}`,
                    icon: Calendar,
                });
            });

        Array.from(credits)
            .sort((left, right) => left - right)
            .forEach((credit) => {
                pushSuggestion({
                    type: 'credits',
                    value: String(credit),
                    label: `Credits: ${credit}`,
                    icon: Hash,
                });
            });

        Array.from(levels)
            .sort((left, right) => left - right)
            .forEach((level) => {
                pushSuggestion({
                    type: 'level',
                    value: String(level),
                    label: `Level: ${level}`,
                    icon: Layers,
                });
            });

        pushSuggestion({ type: 'gpa', value: '3.0', label: 'GPA ≥ 3.0', icon: TrendingUp });
        pushSuggestion({ type: 'gpa', value: '3.5', label: 'GPA ≥ 3.5', icon: TrendingUp });
        pushSuggestion({ type: 'gpa', value: '4.0', label: 'GPA = 4.0', icon: TrendingUp });

        const suggestions = Array.from(groupedSuggestionsMap.values()).flat();

        const groupedSuggestions = ['category', 'semester', 'credits', 'level', 'gpa']
            .map((type) => ({
                type,
                label: COURSE_FILTER_GROUP_LABELS[type] ?? type,
                items: groupedSuggestionsMap.get(type) ?? [],
            }))
            .filter((group) => group.items.length > 0);

        return {
            indexedCourses,
            suggestions,
            groupedSuggestions,
            discoveredSubjectCodes: Array.from(subjectCodes).sort((left, right) => left.localeCompare(right)),
        };
    }, [programCourses]);

    const resolvedSubjectColorMap = useMemo(
        () => resolveSubjectColorAssignments(allCoursesIndex.discoveredSubjectCodes, subjectColorMap),
        [allCoursesIndex.discoveredSubjectCodes, subjectColorMap],
    );
    const normalizedCourseQuery = useMemo(
        () => deferredCourseSearchQuery.trim().toLowerCase(),
        [deferredCourseSearchQuery],
    );

    const filteredAndSortedCourses = useMemo(() => {
        let courses = [...allCoursesIndex.indexedCourses];

        if (activeFilters.length > 0) {
            courses = courses.filter((course) => {
                return activeFilters.every((filter) => {
                    switch (filter.type) {
                        case 'category':
                            return course.category === filter.value;
                        case 'semester':
                            return course.semesterName === filter.value;
                        case 'credits':
                            return String(course.credits) === filter.value;
                        case 'level':
                            return course.courseLevel !== null && String(course.courseLevel) === filter.value;
                        case 'gpa': {
                            const threshold = parseFloat(filter.value);
                            if (threshold === 4.0) {
                                return course.grade_scaled === 4.0;
                            }
                            return course.grade_scaled >= threshold;
                        }
                        default:
                            return true;
                    }
                });
            });
        }

        if (normalizedCourseQuery) {
            courses = courses.filter((course) => (
                course.normalizedName.includes(normalizedCourseQuery)
                || course.normalizedAlias.includes(normalizedCourseQuery)
                || course.normalizedCategory.includes(normalizedCourseQuery)
            ));
        }

        return courses;
    }, [activeFilters, allCoursesIndex.indexedCourses, normalizedCourseQuery]);

    const columns = useMemo<ColumnDef<IndexedCourseWithProgramContext>[]>(() => [
        {
            key: 'name',
            label: 'Course Name',
            fit: 'fill',
            minWidth: 220,
            sortable: true,
            cell: (course) => (
                <div className="flex flex-col">
                    <Link to={`/courses/${course.id}`} className="font-medium hover:underline">
                        {course.name}
                    </Link>
                </div>
            ),
        },
        {
            key: 'category',
            label: 'Category',
            width: 144,
            sortable: (left, right) => (left.category ?? '').localeCompare(right.category ?? ''),
            cell: (course) => (
                course.category ? (
                    <Badge
                        variant="outline"
                        className={`border-0 font-medium ${getCourseCategoryBadgeClassName(course.category)}`}
                        style={getCourseBadgeStyle(resolveCourseColor(course, resolvedSubjectColorMap))}
                    >
                        {course.category}
                    </Badge>
                ) : null
            ),
        },
        {
            key: 'semesterName',
            label: 'Semester',
            width: 168,
            sortable: true,
            cell: (course) => (
                <span className="text-muted-foreground">
                    {course.semesterId ? (
                        <Link to={`/semesters/${course.semesterId}`} className="hover:underline">
                            {course.semesterName}
                        </Link>
                    ) : (
                        <span>{course.semesterName}</span>
                    )}
                </span>
            ),
        },
        {
            key: 'credits',
            label: 'Credits',
            width: 92,
            sortable: true,
        },
        {
            key: 'grade_percentage',
            label: 'Grade',
            width: 108,
            align: 'right',
            sortable: true,
            cell: (course) => (
                course.hide_gpa ? '****' : formatGpaPercentage(course.grade_percentage)
            ),
        },
        {
            key: 'grade_scaled',
            label: 'GPA',
            width: 96,
            align: 'right',
            sortable: true,
            cell: (course) => (
                course.hide_gpa ? '****' : (
                    <span className={course.grade_scaled >= 3.0 ? 'font-medium text-emerald-600' : 'font-medium text-amber-600'}>
                        <AnimatedNumber
                            value={course.grade_scaled}
                            format={(value) => value.toFixed(2)}
                        />
                    </span>
                )
            ),
        },
        {
            key: 'actions',
            label: '',
            width: 52,
            align: 'right',
            cell: (course) => (
                <DataTableActionMenu triggerLabel={`Open actions for ${course.name}`}>
                    <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setCoursePendingDelete(course)}
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                </DataTableActionMenu>
            ),
            cellClassName: 'align-middle',
        },
    ], [resolvedSubjectColorMap]);

    const submitDeleteCourse = useCallback(async () => {
        if (!coursePendingDelete) {
            return;
        }

        setIsDeletingCourse(true);
        try {
            await api.deleteCourse(coursePendingDelete.id);
            setCoursePendingDelete(null);
            await onRefresh();
        } catch (error) {
            console.error('Failed to delete course', error);
            await showAlert({
                title: 'Delete failed',
                description: 'Failed to delete course.',
            });
        } finally {
            setIsDeletingCourse(false);
        }
    }, [coursePendingDelete, onRefresh, showAlert]);

    return (
        <section className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-lg font-semibold tracking-tight">
                    All Courses
                </h2>
                <div className="flex-1 max-w-sm space-y-1.5">
                    <Combobox<CourseFilterSuggestion, true>
                        items={allCoursesIndex.suggestions}
                        multiple
                        itemToStringValue={(suggestion) => suggestion.label}
                        isItemEqualToValue={(item, value) => item.type === value.type && item.value === value.value}
                        onInputValueChange={setCourseSearchQuery}
                        value={activeFilters}
                        onValueChange={(value) => {
                            setActiveFilters(Array.isArray(value) ? value : []);
                            setCourseSearchQuery('');
                        }}
                        autoHighlight
                    >
                        <ComboboxChips ref={suggestionsAnchor} className="w-full">
                            <ComboboxValue>
                                {(values) => (
                                    <>
                                        <Search className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
                                        {values.map((filter: CourseFilterSuggestion) => (
                                            <ComboboxChip key={`${filter.type}-${filter.value}`}>
                                                {filter.label}
                                            </ComboboxChip>
                                        ))}
                                        <ComboboxChipsInput
                                            placeholder={values.length > 0 ? 'Add more filters...' : 'Search or filter courses...'}
                                        />
                                    </>
                                )}
                            </ComboboxValue>
                        </ComboboxChips>
                        <ComboboxContent anchor={suggestionsAnchor}>
                            <ComboboxEmpty>No items found.</ComboboxEmpty>
                            <ComboboxList>
                                {allCoursesIndex.groupedSuggestions.map((group) => (
                                    <ComboboxGroup key={group.type}>
                                        <ComboboxLabel>{group.label}</ComboboxLabel>
                                        {group.items.map((suggestion) => {
                                            const Icon = suggestion.icon;
                                            return (
                                                <ComboboxItem
                                                    key={`${suggestion.type}-${suggestion.value}`}
                                                    value={suggestion}
                                                    className="pr-2 [&>span.absolute]:hidden"
                                                >
                                                    <Icon className="text-muted-foreground" />
                                                    <span>{suggestion.label}</span>
                                                </ComboboxItem>
                                            );
                                        })}
                                    </ComboboxGroup>
                                ))}
                            </ComboboxList>
                        </ComboboxContent>
                    </Combobox>
                </div>
            </div>
            {filteredAndSortedCourses.length === 0 ? (
                <div className="rounded-md border bg-card min-h-[300px] flex flex-col overflow-hidden">
                    <AppEmptyState
                        scenario={courseSearchQuery || activeFilters.length > 0 ? 'no-results' : 'create'}
                        size="section"
                        surface="inherit"
                        className="flex-1 rounded-none border-0 px-6 py-10"
                        title={courseSearchQuery || activeFilters.length > 0 ? 'No matching courses' : 'No courses yet'}
                        description={courseSearchQuery || activeFilters.length > 0
                            ? 'Adjust the search or filters to see more courses.'
                            : 'Add a course to start tracking grades and organization inside this Program.'}
                        primaryAction={courseSearchQuery || activeFilters.length > 0 ? undefined : (
                            <Button
                                type="button"
                                onClick={onOpenCourseModal}
                            >
                                Add Course
                            </Button>
                        )}
                    />
                </div>
            ) : (
                <DataTable
                    title="All Courses"
                    description="Review every course in this Program."
                    showHeader={false}
                    items={filteredAndSortedCourses}
                    getRowKey={(course) => course.id}
                    columns={columns}
                    bodyHeight={480}
                    pagination={{ pageSize: COURSE_PAGE_SIZE, itemLabel: 'courses' }}
                    minWidthClassName="min-w-[820px]"
                />
            )}
            <AlertDialog
                open={coursePendingDelete !== null}
                onOpenChange={(nextOpen) => {
                    if (!isDeletingCourse && !nextOpen) {
                        setCoursePendingDelete(null);
                    }
                }}
            >
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete course?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {`Are you sure you want to delete ${coursePendingDelete?.name || 'this course'}? This action cannot be undone.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingCourse}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={submitDeleteCourse}
                            disabled={isDeletingCourse}
                        >
                            {isDeletingCourse ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    );
};

const ProgramDashboardContent: React.FC = () => {
    const { program, setProgram, saveProgram, refreshProgram, isLoading } = useProgramData();
    const { user, setActiveProgram } = useAuth();
    const { alert: showAlert } = useDialog();
    const [unassignedCourses, setUnassignedCourses] = useState<Array<CourseWithProgramContext>>([]);
    const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
    const programId = program?.id ?? null;
    const layoutCommandGroups = useMemo<LayoutCommandGroup[]>(() => {
        if (!programId) {
            return [];
        }

        return [
            {
                heading: 'Program',
                items: [
                    {
                        id: `program-add-course-${programId}`,
                        title: 'Add Course',
                        description: 'Create or import a course in the current Program.',
                        keywords: ['new course', 'import course'],
                        icon: Plus,
                        onSelect: () => setIsCourseModalOpen(true),
                    },
                ],
            },
        ];
    }, [programId]);

    const refreshUnassignedCourses = useCallback(async () => {
        if (!programId) {
            setUnassignedCourses([]);
            return;
        }

        try {
            const courses = await api.getCoursesForProgram(programId, { unassigned: true });
            setUnassignedCourses(
                courses.map((course) => ({
                    ...course,
                    semesterName: 'Unassigned',
                    semesterId: '',
                    semesterStartDate: null,
                })),
            );
        } catch (error) {
            console.error('Failed to fetch unassigned program courses', error);
            setUnassignedCourses([]);
        }
    }, [programId]);

    const refreshDashboardData = useCallback(async () => {
        await Promise.all([
            refreshProgram(),
            refreshUnassignedCourses(),
        ]);
    }, [refreshProgram, refreshUnassignedCourses]);

    const handleUpdateProgram = useCallback(async (data: Parameters<typeof saveProgram>[0]) => {
        if (!program) return;
        await saveProgram(data);
    }, [program, saveProgram]);

    const visibleSemesters = useMemo<VisibleSemester[]>(
        () => (program?.semesters ?? []).filter((semester) => semester.lifecycle_state !== 'draft'),
        [program?.semesters],
    );

    const subjectColorMap = useMemo(
        () => parseSubjectColorMap(program?.subject_color_map),
        [program?.subject_color_map],
    );

    const programCourses = useMemo<Array<CourseWithProgramContext>>(() => {
        const semesterCourses = visibleSemesters
            .flatMap((semester) =>
                (semester.courses || []).map((course) => ({
                    ...course,
                    semesterName: semester.name,
                    semesterId: semester.id,
                    semesterStartDate: semester.start_date ?? null,
                })),
            );
        return [...semesterCourses, ...unassignedCourses];
    }, [unassignedCourses, visibleSemesters]);

    const totalCredits = useMemo(
        () => programCourses.reduce((sum, course) => sum + (course.credits || 0), 0),
        [programCourses],
    );

    const resolvedSubjectColorMap = useMemo(() => {
        const subjectCodes = programCourses
            .map((course) => resolveCourseSubjectCode(course))
            .filter(Boolean);
        return resolveSubjectColorAssignments(subjectCodes, subjectColorMap);
    }, [programCourses, subjectColorMap]);

    useEffect(() => {
        void refreshUnassignedCourses();
    }, [refreshUnassignedCourses]);

    useEffect(() => {
        if (!program?.id || user?.active_program_id === program.id) {
            return;
        }
        void setActiveProgram(program.id);
    }, [program?.id, setActiveProgram, user?.active_program_id]);

    const creditsProgressPercent = useMemo(() => {
        if (!program) return 0;
        const maxCredits = program.grad_requirement_credits || 0;
        if (maxCredits <= 0) return 0;
        return Math.min((totalCredits / maxCredits) * 100, 100);
    }, [program, totalCredits]);

    const breadcrumb = (
        <Breadcrumb>
            <BreadcrumbList className="text-xs font-medium text-muted-foreground">
                <BreadcrumbItem>
                    <BreadcrumbPage className="text-foreground font-semibold">
                        {program?.name || 'Program'}
                    </BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );

    const programHomeSettings = useMemo(
        () => parseProgramHomeSettings(program?.tab_settings),
        [program?.tab_settings],
    );

    const commitProgramHomeSettings = useCallback(async (nextSettings: ProgramHomeSettings) => {
        if (!program) {
            return;
        }

        setProgram((current) => {
            if (!current) {
                return current;
            }
            return {
                ...current,
                tab_settings: replaceProgramHomeTabSetting(current.tab_settings, nextSettings),
            };
        });

        try {
            await api.upsertProgramTabSettings(program.id, PROGRAM_HOME_TAB_TYPE, {
                settings: serializeProgramHomeSettings(nextSettings),
            });
        } catch (error) {
            console.error('Failed to save Program Home settings', error);
            await refreshProgram();
            await showAlert({
                title: 'Save failed',
                description: 'Failed to save Program Home changes.',
            });
        }
    }, [program, refreshProgram, setProgram, showAlert]);

    if (!isLoading && !program) {
        return (
            <Layout>
                <Container size="wide">
                    <AppEmptyState
                        scenario="not-found"
                        size="page"
                        title="Program not found"
                        description="The program you are looking for does not exist or has been deleted."
                        primaryAction={(
                            <Link to="/">
                                <Button>Back to Home</Button>
                            </Link>
                        )}
                    />
                </Container>
            </Layout>
        );
    }

    return (
        <Layout breadcrumb={breadcrumb} commandGroups={layoutCommandGroups}>
            <div className="sticky-page-header border-b bg-background sticky top-[60px] z-20">
                <Container size="wide" className="py-4 md:py-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            {isLoading || !program ? (
                                <Skeleton className="h-8 w-48" />
                            ) : (
                                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                                        {program.name}
                                    </h1>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {program && (
                                <Button variant="outline" aria-label="Program Settings" asChild>
                                    <Link to={`/programs/${program.id}/settings`}>
                                        <Settings />
                                    </Link>
                                </Button>
                            )}
                            <Button
                                onClick={(e) => {
                                    e.currentTarget.blur();
                                    setIsCourseModalOpen(true);
                                }}
                                variant="outline"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Course
                            </Button>
                            {program ? (
                                <CreateSemesterWizardButton
                                    id="onboarding-new-semester-btn"
                                    programId={program.id}
                                    onChanged={refreshDashboardData}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Semester
                                </CreateSemesterWizardButton>
                            ) : null}
                        </div>
                    </div>
                </Container>
            </div>

            <Container size="wide" className="space-y-8 py-8 md:space-y-10 md:py-10">
                {isLoading || !program ? (
                    <>
                        {/* Overview Section Skeleton */}
                        <section>
                            <TextSkeleton variant="h3" className="mb-4" />
                            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
                                {[1, 2, 3].map(i => (
                                    <StatCardSkeleton key={i} />
                                ))}
                            </div>
                        </section>

                        <Separator />

                        {/* Semesters Section Skeleton */}
                        <section className="space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <TextSkeleton variant="h3" />
                                <Skeleton className="h-10 w-full max-w-sm" />
                            </div>
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <SemesterCardSkeleton key={i} />
                                ))}
                            </div>
                        </section>
                    </>
                ) : (
                    <>
                        {/* Stats Section */}
                        <section>
                                <div className="md:hidden relative rounded-xl border border-border/60 bg-muted/15 px-4 py-3">
                                    <Button
                                        onClick={() => handleUpdateProgram({ hide_gpa: !program.hide_gpa })}
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-3 top-3 h-5 w-5 p-0"
                                        aria-label={program.hide_gpa ? 'Show GPA' : 'Hide GPA'}
                                    >
                                        {program.hide_gpa ? (
                                            <EyeOff className="h-3 w-3" />
                                        ) : (
                                            <Eye className="h-3 w-3" />
                                        )}
                                    </Button>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="min-w-0">
                                            <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                                                <GraduationCap className="h-3 w-3" />
                                                <span>GPA</span>
                                            </div>
                                            <div className="text-lg font-semibold leading-none">
                                                {program.hide_gpa ? '****' : (
                                                    <AnimatedNumber
                                                        value={program.cgpa_scaled}
                                                        format={(val) => val.toFixed(2)}
                                                        animateOnMount
                                                        rainbowThreshold={3.8}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                                                <Percent className="h-3 w-3" />
                                                <span>Avg</span>
                                            </div>
                                            <div className="text-lg font-semibold leading-none">
                                                {program.hide_gpa ? '****' : (
                                                    <>
                                                        <AnimatedNumber
                                                            value={program.cgpa_percentage}
                                                            format={formatGpaPercentageValue}
                                                            animateOnMount
                                                        />
                                                        <span className="ml-0.5 text-xs font-normal text-muted-foreground">%</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                                                <BookOpen className="h-3 w-3" />
                                                <span>Credits</span>
                                            </div>
                                            <div className="text-lg font-semibold leading-none">
                                                <AnimatedNumber
                                                    value={totalCredits}
                                                    format={(val) => val.toFixed(1)} // Format cleaner
                                                    animateOnMount
                                                />
                                                <span className="mx-0.5 text-xs font-normal text-muted-foreground">/</span>
                                                <span className="text-xs font-normal text-muted-foreground">{program.grad_requirement_credits}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="hidden gap-4 md:grid md:grid-cols-3 xl:grid-cols-4">
                                    <Card className="border-border/50 bg-muted/10 shadow-none">
                                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-1.5">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">CGPA (Scaled)</CardTitle>
                                            <GraduationCap className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent className="flex min-h-12 items-end pt-0">
                                            <div className="flex w-full items-end justify-between gap-3">
                                                <div className="text-[1.5rem] font-semibold tracking-tight leading-none">
                                                    {program.hide_gpa ? '****' : (
                                                        <AnimatedNumber
                                                            value={program.cgpa_scaled}
                                                            format={(val) => val.toFixed(2)}
                                                            animateOnMount
                                                            rainbowThreshold={3.8}
                                                        />
                                                    )}
                                                </div>
                                                <Button
                                                    onClick={() => handleUpdateProgram({ hide_gpa: !program.hide_gpa })}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="-mr-1 -mt-1 h-7 w-7 p-0 text-muted-foreground"
                                                    aria-label={program.hide_gpa ? 'Show GPA' : 'Hide GPA'}
                                                >
                                                    {program.hide_gpa ? (
                                                        <EyeOff className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <Eye className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-border/50 bg-muted/10 shadow-none">
                                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-1.5">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">Average</CardTitle>
                                            <Percent className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent className="flex min-h-12 items-end pt-0">
                                            <div className="text-[1.5rem] font-semibold tracking-tight leading-none">
                                                {program.hide_gpa ? '****' : (
                                                    <>
                                                        <AnimatedNumber
                                                            value={program.cgpa_percentage}
                                                            format={formatGpaPercentageValue}
                                                            animateOnMount
                                                        />
                                                        <span className="ml-1 text-base font-normal text-muted-foreground">%</span>
                                                    </>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-border/50 bg-muted/10 shadow-none">
                                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-1.5">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">Credits Progress</CardTitle>
                                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent className="flex min-h-12 flex-col justify-end gap-2 pt-0">
                                            {program.grad_requirement_credits > 0 ? (
                                                <>
                                                    <div className="text-[1.5rem] font-semibold tracking-tight leading-none">
                                                        <AnimatedNumber
                                                            value={totalCredits}
                                                            format={(val) => val.toFixed(1)}
                                                            animateOnMount
                                                        />
                                                        <span className="mx-1 text-base font-normal text-muted-foreground">/</span>
                                                        <span className="text-base font-normal text-muted-foreground">{program.grad_requirement_credits}</span>
                                                    </div>
                                                    <Progress value={creditsProgressPercent} />
                                                </>
                                            ) : (
                                                <>
                                                    <div className="text-[1.5rem] font-semibold tracking-tight leading-none">
                                                        <AnimatedNumber
                                                            value={totalCredits}
                                                            format={(val) => val.toFixed(1)}
                                                            animateOnMount
                                                        />
                                                        <span className="ml-1 text-base font-normal text-muted-foreground">credits</span>
                                                    </div>
                                                    <Link
                                                        to={`/programs/${program.id}/settings`}
                                                        className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
                                                    >
                                                        Set graduation target →
                                                    </Link>
                                                </>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </section>

                            <Separator />

                            <ProgramFocusBoard
                                semesters={program.semesters}
                                programCourses={programCourses}
                                settings={programHomeSettings}
                                onCommit={commitProgramHomeSettings}
                                subjectColorMap={resolvedSubjectColorMap}
                            />

                            <Separator />

                            <SemestersSection
                                semesters={visibleSemesters}
                                programId={program.id}
                                hideGpa={program.hide_gpa ?? false}
                                onRefresh={refreshDashboardData}
                                showAlert={showAlert}
                            />

                            <AllCoursesSection
                                programCourses={programCourses}
                                subjectColorMap={subjectColorMap}
                                onOpenCourseModal={() => setIsCourseModalOpen(true)}
                                onRefresh={refreshDashboardData}
                                showAlert={showAlert}
                            />
                    </>
                )}
            </Container>

            {program && (
                <CourseManagerModal
                    isOpen={isCourseModalOpen}
                    onClose={() => setIsCourseModalOpen(false)}
                    programId={program.id}
                    onCourseAdded={refreshDashboardData}
                />
            )}
        </Layout>
    );
};

export const ProgramHomePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();

    if (!id) {
        return (
            <Layout>
                <Container size="wide">
                    <AppEmptyState
                        scenario="not-found"
                        size="page"
                        title="Program not found"
                        description="No program ID provided."
                        primaryAction={(
                            <Link to="/">
                                <Button>Back to Home</Button>
                            </Link>
                        )}
                    />
                </Container>
            </Layout>
        );
    }

    return (
        <ProgramDataProvider programId={id}>
            <ProgramDashboardContent />
        </ProgramDataProvider>
    );
};

export const ProgramDashboard = ProgramHomePage;
