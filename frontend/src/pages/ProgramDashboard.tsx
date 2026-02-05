import React, { useEffect, useId, useState, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SettingsModal } from '../components/SettingsModal';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Container } from '../components/Container';
import api from '../services/api';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { ProgramSkeleton } from '../components/Skeleton/ProgramSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgramDataProvider, useProgramData } from '../contexts/ProgramDataContext';
import { CourseManagerModal } from '../components/CourseManagerModal';
import { useDialog } from '../contexts/DialogContext';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Settings, Plus, Upload, Search, Trash2, GraduationCap, Percent, BookOpen } from 'lucide-react';

const ProgramDashboardContent: React.FC = () => {
    const { program, updateProgram, refreshProgram, isLoading } = useProgramData();
    const { alert: showAlert, confirm } = useDialog();

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
    const [newSemesterName, setNewSemesterName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const semesterNameId = useId();

    // Ref to track the latest newSemesterName, avoiding stale closure
    const newSemesterNameRef = useRef(newSemesterName);
    useEffect(() => {
        newSemesterNameRef.current = newSemesterName;
    }, [newSemesterName]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.name.endsWith('.ics') || file.type === 'text/calendar') {
                setSelectedFile(file);
                // Auto-fill name from filename only if name is empty
                if (!newSemesterNameRef.current) {
                    const name = file.name.replace('.ics', '').replace(/[_-]/g, ' ');
                    setNewSemesterName(name);
                }
            } else {
                await showAlert({
                    title: "Invalid file",
                    description: "Please upload a valid .ics file."
                });
            }
        }
    };

    // Settings Modal State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const handleCreateSemester = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!program) return;

        setIsSubmitting(true);
        try {
            if (selectedFile) {
                await api.uploadSemesterICS(program.id, selectedFile, newSemesterName || undefined);
            } else {
                await api.createSemester(program.id, {
                    name: newSemesterName
                });
            }
            setIsModalOpen(false);
            setNewSemesterName('');
            setSelectedFile(null);
            refreshProgram();
        } catch (error) {
            console.error("Failed to create semester", error);
            await showAlert({
                title: "Create failed",
                description: "Failed to create semester."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateProgram = async (data: any) => {
        if (!program) return;
        updateProgram(data);
    };

    const totalCredits = React.useMemo(() => {
        if (!program) return 0;
        return program.semesters.reduce(
            (acc, sem: any) => acc + (sem.courses?.reduce((cAcc: number, c: any) => cAcc + c.credits, 0) || 0),
            0
        );
    }, [program]);

    const normalizedQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

    const filteredSemesters = useMemo(() => {
        if (!program) return [];
        if (!normalizedQuery) return program.semesters;
        return program.semesters.filter(semester =>
            semester.name.toLowerCase().includes(normalizedQuery)
        );
    }, [program, normalizedQuery]);



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
                    <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground transition-colors">
                        <Link to="/">Academics</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbPage className="text-foreground font-semibold">
                        {program?.name || 'Program'}
                    </BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );

    if (!isLoading && !program) {
        return (
            <Layout>
                <Container>
                    <Empty className="my-16">
                        <EmptyHeader>
                            <EmptyTitle>Program not found</EmptyTitle>
                            <EmptyDescription>
                                The program you are looking for does not exist or has been deleted.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Link to="/">
                                <Button>Back to Home</Button>
                            </Link>
                        </EmptyContent>
                    </Empty>
                </Container>
            </Layout>
        );
    }

    return (
        <Layout breadcrumb={breadcrumb}>
            <div className="border-b bg-background sticky top-0 z-20">
                <Container className="py-4 md:py-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            {isLoading || !program ? (
                                <Skeleton className="h-8 w-48" />
                            ) : (
                                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl flex items-center gap-3">
                                        {program.name}
                                    <Button
                                            variant="ghost"
                                        size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            onClick={() => setIsSettingsOpen(true)}
                                    >
                                            <Settings className="h-4 w-4" />
                                    </Button>
                                    </h1>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button onClick={() => setIsCourseModalOpen(true)} variant="outline" size="sm">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Course
                            </Button>
                            <Button onClick={() => setIsModalOpen(true)} size="sm">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Semester
                            </Button>
                        </div>
                    </div>
                </Container>
            </div>

            <Container className="py-8 md:py-10 space-y-10">
                {isLoading || !program ? (
                    <ProgramSkeleton />
                ) : (
                    <>
                        {/* Stats Section */}
                        <section>
                            <h2 className="text-lg font-semibold tracking-tight mb-4 flex items-center gap-2">
                                Overview
                            </h2>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">CGPA (Scaled)</CardTitle>
                                            <GraduationCap className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold flex items-center justify-between">
                                                {program.hide_gpa ? '****' : (
                                                    <AnimatedNumber
                                                        value={program.cgpa_scaled}
                                                        format={(val) => val.toFixed(2)}
                                                        animateOnMount
                                                    />
                                                )}
                                                <Button
                                                    onClick={() => handleUpdateProgram({ hide_gpa: !program.hide_gpa })}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                >
                                                    {program.hide_gpa ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8-11-8-11-8-11-8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                    )}
                                                </Button>
                                        </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Cumulative Grade Point Average
                                            </p>
                                    </CardContent>
                                </Card>

                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Average</CardTitle>
                                            <Percent className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">
                                                {program.hide_gpa ? '****' : (
                                                <>
                                                    <AnimatedNumber
                                                        value={program.cgpa_percentage}
                                                        format={(val) => val.toFixed(1)}
                                                        animateOnMount
                                                    />
                                                        <span className="text-base font-normal text-muted-foreground ml-1">%</span>
                                                </>
                                            )}
                                        </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Overall score percentage
                                            </p>
                                    </CardContent>
                                </Card>

                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Credits Progress</CardTitle>
                                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">
                                                <AnimatedNumber
                                                    value={totalCredits}
                                                    format={(val) => val.toFixed(1)} // Format cleaner
                                                    animateOnMount
                                                />
                                                <span className="text-base font-normal text-muted-foreground mx-1">/</span>
                                                <span className="text-base font-normal text-muted-foreground">{program.grad_requirement_credits}</span>
                                        </div>
                                            <Progress value={creditsProgressPercent} className="mt-2 h-2" />
                                    </CardContent>
                                </Card>
                                </div>
                            </section>

                            <Separator />

                            {/* Semesters Section */}
                            <section className="space-y-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <h2 className="text-lg font-semibold tracking-tight">
                                        Semesters
                                    </h2>
                                    <div className="relative flex-1 max-w-sm">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search semesters..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 h-10"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                    {filteredSemesters.map(semester => (
                                    <Link key={semester.id} to={`/semesters/${semester.id}`}>
                                            <Card className="group h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md">
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <CardTitle className="text-lg font-semibold truncate pr-4">
                                                        {semester.name}
                                                    </CardTitle>
                                                    <Button
                                                        onClick={async (e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            const shouldDelete = await confirm({
                                                                title: "Delete semester?",
                                                            description: "Are you sure you want to delete this semester? This action cannot be undone.",
                                                            confirmText: "Delete",
                                                            cancelText: "Cancel",
                                                            tone: "destructive"
                                                        });
                                                            if (!shouldDelete) return;
                                                            api.deleteSemester(semester.id)
                                                                .then(() => refreshProgram())
                                                                .catch(err => console.error("Failed to delete", err));
                                                        }}
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                            </CardHeader>
                                                <CardContent>
                                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                                    <div>
                                                            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">GPA</p>
                                                            <p className="text-lg font-semibold">{semester.average_scaled.toFixed(2)}</p>
                                                    </div>
                                                        <div className="text-right">
                                                            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Average</p>
                                                            <p className="text-lg font-semibold">{semester.average_percentage.toFixed(1)}%</p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 pt-4 border-t flex justify-between items-center text-sm text-muted-foreground">
                                                        <span>{(semester as any).courses?.length || 0} Courses</span>
                                                        <div
                                                            className={`h-2 w-2 rounded-full ${semester.average_scaled >= 3.0 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                        />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                                    {filteredSemesters.length === 0 && (
                                        <div className="col-span-full border rounded-lg border-dashed p-8 text-center">
                                            <p className="text-muted-foreground">No semesters found</p>
                                            <Button variant="link" onClick={() => setIsModalOpen(true)} className="mt-2 text-primary">
                                                Create one
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* All Courses Section */}
                            <section className="space-y-6">
                                <h2 className="text-lg font-semibold tracking-tight">
                                    All Courses
                                </h2>
                                <div className="rounded-md border bg-card">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead>Course Name</TableHead>
                                                <TableHead>Semester</TableHead>
                                                <TableHead>Credits</TableHead>
                                                <TableHead className="text-right">Grade</TableHead>
                                                <TableHead className="text-right">GPA</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(() => {
                                                const allCourses = program.semesters.flatMap(sem =>
                                                    (sem.courses || []).map(course => ({
                                                        ...course,
                                                        semesterName: sem.name,
                                                        semesterId: sem.id
                                                    }))
                                                ).sort((a, b) => a.name.localeCompare(b.name));

                                                if (allCourses.length === 0) {
                                                    return (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="h-24 text-center">
                                                                No courses added yet.
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                }

                                                return allCourses.map(course => (
                                                    <TableRow key={course.id}>
                                                        <TableCell className="font-medium">
                                                            <Link to={`/courses/${course.id}`} className="hover:underline">
                                                                {course.name}
                                                            </Link>
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            <Link to={`/semesters/${course.semesterId}`} className="hover:underline">
                                                                {course.semesterName}
                                                            </Link>
                                                        </TableCell>
                                                        <TableCell>{course.credits}</TableCell>
                                                        <TableCell className="text-right">
                                                            {course.hide_gpa ? '****' : (
                                                                <span>{course.grade_percentage.toFixed(1)}%</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            {course.hide_gpa ? '****' : (
                                                                <span className={course.grade_scaled >= 3.0 ? 'text-emerald-600' : 'text-amber-600'}>
                                                                    {course.grade_scaled.toFixed(2)}
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ));
                                            })()}
                                        </TableBody>
                                    </Table>
                                </div>
                            </section>
                    </>
                )}
            </Container>

            <Dialog open={isModalOpen} onOpenChange={(open) => !open && setIsModalOpen(false)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create New Semester</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateSemester} className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor={semesterNameId}>Semester Name</Label>
                            <Input
                                id={semesterNameId}
                                placeholder="e.g. Fall 2025"
                                value={newSemesterName}
                                onChange={(e) => setNewSemesterName(e.target.value)}
                                required={!selectedFile}
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Import Schedule (Optional)</Label>
                            <div
                                className={`
                                    border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
                                    ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                                `}
                                onClick={() => document.getElementById('ics-upload')?.click()}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <input
                                    type="file"
                                    id="ics-upload"
                                    accept=".ics"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setSelectedFile(file);
                                            if (!newSemesterNameRef.current) {
                                                const name = file.name.replace('.ics', '').replace(/[_-]/g, ' ');
                                                setNewSemesterName(name);
                                            }
                                        }
                                    }}
                                />
                                <div className="flex flex-col items-center gap-2">
                                    {selectedFile ? (
                                        <div className="flex items-center gap-2 text-primary font-medium">
                                            <Upload className="h-5 w-5" />
                                            {selectedFile.name}
                                        </div>
                                    ) : (
                                        <>
                                                <Upload className="h-8 w-8 text-muted-foreground/50" />
                                                <div className="text-sm text-muted-foreground">
                                                    Click or drag .ics file to upload
                                                </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Creating...' : (selectedFile ? 'Upload & Create' : 'Create Semester')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {program && (
                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    title="Program Settings"
                    initialName={program.name}
                    initialSettings={{
                        grad_requirement_credits: program.grad_requirement_credits,
                        gpa_scaling_table: program.gpa_scaling_table,
                        hide_gpa: program.hide_gpa
                    }}
                    onSave={handleUpdateProgram}
                    type="program"
                />
            )}

            {program && (
                <CourseManagerModal
                    isOpen={isCourseModalOpen}
                    onClose={() => setIsCourseModalOpen(false)}
                    programId={program.id}
                    onCourseAdded={refreshProgram}
                />
            )}
        </Layout>
    );
};

export const ProgramDashboard: React.FC = () => {
    const { id } = useParams<{ id: string }>();

    if (!id) {
        return (
            <Layout>
                <Container>
                    <Empty className="my-16">
                        <EmptyHeader>
                            <EmptyTitle>Program not found</EmptyTitle>
                            <EmptyDescription>No program ID provided.</EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Link to="/">
                                <Button>Back to Home</Button>
                            </Link>
                        </EmptyContent>
                    </Empty>
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
