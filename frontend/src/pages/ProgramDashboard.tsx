import React, { useEffect, useId, useState, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SettingsModal } from '../components/SettingsModal';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Container } from '../components/Container';
import api from '../services/api';
import { useHeroGradient } from '../hooks/useHeroGradient';
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

    const heroStyle = useHeroGradient();
    const glassButtonClassName =
        "border border-border bg-[color:var(--color-bg-glass)] text-foreground backdrop-blur-md shadow-none hover:bg-[color:var(--color-bg-glass)] hover:text-foreground hover:shadow-md";

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

    const filteredCourses = useMemo(() => {
        if (!program) return [];
        const courses = program.semesters.flatMap((s: any) => s.courses || []);
        if (!normalizedQuery) return courses;
        return courses.filter((course: any) =>
            course.name.toLowerCase().includes(normalizedQuery) ||
            (course.alias && course.alias.toLowerCase().includes(normalizedQuery))
        );
    }, [program, normalizedQuery]);

    const creditsProgressPercent = useMemo(() => {
        if (!program) return 0;
        const maxCredits = program.grad_requirement_credits || 0;
        if (maxCredits <= 0) return 0;
        return Math.min((totalCredits / maxCredits) * 100, 100);
    }, [program, totalCredits]);

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
        <Layout>
            <div
                className="hero-section"
                style={{
                    ...heroStyle,
                    color: 'var(--color-text-primary)',
                    '--hero-padding-y': '2.5rem',
                    '--hero-padding-y-mobile': '1.5rem',
                    '--hero-margin-bottom': '1.25rem',
                } as React.CSSProperties}>
                <Container>
                    <Breadcrumb>
                        <BreadcrumbList
                            style={{
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                letterSpacing: '0.05em',
                                color: 'var(--color-primary)',
                                marginBottom: '0.5rem',
                                textTransform: 'uppercase'
                            }}
                        >
                            <BreadcrumbItem>
                                <BreadcrumbLink asChild className="text-primary">
                                    <Link to="/">Academic</Link>
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbPage className="text-primary normal-case">
                                    {program?.name || 'Program'}
                                </BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                    <div className="page-header" style={{ marginBottom: '2.5rem' }}>
                        {isLoading || !program ? (
                            <Skeleton className="h-14 w-1/2" />
                        ) : (
                                <h1 className="noselect text-truncate" style={{ fontSize: '3.5rem', margin: 0, fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(to right, var(--color-text-primary), var(--color-text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                    {program.name}
                                </h1>
                        )}

                        {isLoading || !program ? (
                            <Skeleton className="h-10 w-10 rounded-full" />
                        ) : (
                        <Button
                            variant="outline"
                            size="icon"
                            className={`h-10 w-10 rounded-full ${glassButtonClassName}`}
                            onClick={() => setIsSettingsOpen(true)}
                            title="Program Settings"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="3"></circle>
                                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                    </svg>
                                </Button>
                        )}
                    </div>

                    <div className="program-stats-grid">
                        <div className="noselect program-stat-card">
                            <div className="program-stat-label">
                                <span className="program-stat-label-text">CGPA (Scaled)</span>
                                {!(isLoading || !program) && (
                                    <Button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleUpdateProgram({ hide_gpa: !program.hide_gpa });
                                        }}
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        title={program.hide_gpa ? "Show GPA" : "Hide GPA"}
                                    >
                                        {program.hide_gpa ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                <circle cx="12" cy="12" r="3"></circle>
                                            </svg>
                                        )}
                                    </Button>
                                )}
                            </div>
                            <div className="program-stat-value primary">
                                {isLoading || !program ? (
                                    <Skeleton className="h-8 w-16" />
                                ) : program.hide_gpa ? (
                                    '****'
                                ) : (
                                    <AnimatedNumber
                                        value={program.cgpa_scaled}
                                        format={(val) => val.toFixed(2)}
                                        animateOnMount
                                    />
                                )}
                            </div>
                        </div>
                        <div className="noselect program-stat-card">
                            <div className="program-stat-label">Average (%)</div>
                            <div className="program-stat-value">
                                {isLoading || !program ? (
                                    <Skeleton className="h-8 w-20" />
                                ) : program.hide_gpa ? (
                                    '****'
                                ) : (
                                    <>
                                        <AnimatedNumber
                                            value={program.cgpa_percentage}
                                            format={(val) => val.toFixed(1)}
                                            animateOnMount
                                        />
                                        <span className="program-stat-unit">%</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="noselect program-stat-card">
                            <div className="program-stat-label">Credits Progress</div>
                            <div className="program-stat-value" style={{ marginBottom: '0.5rem' }}>
                                {isLoading || !program ? (
                                    <Skeleton className="h-8 w-[70%]" />
                                ) : (
                                    <>
                                        <AnimatedNumber
                                            value={totalCredits}
                                                format={(val) => val.toFixed(2)}
                                            animateOnMount
                                        />
                                        <span className="program-stat-unit small"> / {program.grad_requirement_credits}</span>
                                    </>
                                )}
                            </div>
                            {isLoading || !program ? (
                                <Skeleton className="h-2 w-full rounded-[4px]" />
                            ) : (
                                    <Progress value={creditsProgressPercent} />
                            )}
                        </div>
                    </div>
                </Container>
            </div>

            {isLoading || !program ? (
                <ProgramSkeleton />
            ) : (
                    <Container padding="3rem 2rem">
                        <div style={{ marginBottom: '2rem' }}>
                            <div className="relative mb-4">
                                <Input
                                    placeholder="Search semesters and courses..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pr-10"
                                    style={{ fontSize: '1.1rem', padding: '1rem' }}
                                />
                                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="page-header" style={{ marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.75rem' }}>Semesters</h2>
                            <Button onClick={() => setIsModalOpen(true)}>+ New Semester</Button>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                            gap: '2rem',
                            marginBottom: '4rem'
                        }}>
                            {filteredSemesters.map(semester => (
                                    <Link key={semester.id} to={`/semesters/${semester.id}`}>
                                        <Card className="noselect h-full cursor-pointer transition-shadow hover:shadow-md">
                                            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
                                                <CardTitle className="text-truncate text-2xl">{semester.name}</CardTitle>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className={`h-2 w-2 rounded-full ${semester.average_scaled >= 3.0 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                    />
                                                    <Button
                                                        onClick={async (e) => {
                                                            e.preventDefault();
                                                            const shouldDelete = await confirm({
                                                                title: "Delete semester?",
                                                                description: "Are you sure you want to delete this semester?",
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
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        </svg>
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="mt-auto pt-0">
                                                <Separator className="mb-4" />
                                                <div className="flex gap-4">
                                                    <div>
                                                        <div className="text-xs uppercase tracking-wider text-muted-foreground">GPA</div>
                                                        <div className="text-lg font-semibold">{semester.average_scaled.toFixed(2)}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs uppercase tracking-wider text-muted-foreground">AVG</div>
                                                        <div className="text-lg font-semibold">{semester.average_percentage.toFixed(1)}%</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs uppercase tracking-wider text-muted-foreground">Courses</div>
                                                        <div className="text-lg font-semibold">{(semester as any).courses?.length || 0}</div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}

                            {filteredSemesters.length === 0 && ( /* ... Empty state ... */
                                <Empty style={{ gridColumn: '1 / -1' }}>
                                    <EmptyHeader>
                                        <EmptyTitle>No semesters found</EmptyTitle>
                                        <EmptyDescription>Try a different search term.</EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            )}
                        </div>

                        {/* Course List Section */}
                        <div style={{ marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.75rem', margin: 0 }}>All Courses</h2>
                                <Button onClick={() => setIsCourseModalOpen(true)}>+ New Course</Button>
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                                gap: '1.5rem'
                            }}>
                                {filteredCourses.map((course: any) => (
                                        <Link key={course.id} to={`/courses/${course.id}`}>
                                            <Card className="transition-colors hover:border-primary">
                                                <CardContent className="flex items-center justify-between p-4">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-truncate font-semibold">{course.name}</div>
                                                        {course.alias && (
                                                            <div className="mt-0.5 text-xs text-muted-foreground">
                                                                {course.alias}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="ml-4 text-sm text-muted-foreground">{course.grade_scaled.toFixed(2)}</div>
                                                </CardContent>
                                            </Card>
                                        </Link>
                                    ))}
                            </div>
                        </div>
                    </Container>
            )}

            <Dialog open={isModalOpen} onOpenChange={(open) => !open && setIsModalOpen(false)}>
                <DialogContent className="p-0 sm:max-w-[520px]">
                    <DialogHeader className="border-b px-6 py-4">
                        <DialogTitle className="text-base font-semibold">Create New Semester</DialogTitle>
                    </DialogHeader>
                    <div className="p-6">
                <form onSubmit={handleCreateSemester}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '270px' }}>
                        <div className="grid gap-2 mb-4">
                            <Label htmlFor={semesterNameId} className="text-muted-foreground">
                                Semester Name
                            </Label>
                            <Input
                                id={semesterNameId}
                                placeholder="e.g. Fall 2025"
                                value={newSemesterName}
                                onChange={(e) => setNewSemesterName(e.target.value)}
                                required={!selectedFile}
                                autoFocus
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Import Schedule (Optional)</div>
                            <div style={{
                                border: `2px dashed ${isDragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                borderRadius: 'var(--radius-md)',
                                padding: '2rem',
                                textAlign: 'center',
                                cursor: 'pointer',
                                background: isDragging ? 'rgba(var(--color-primary-rgb), 0.05)' : 'var(--color-bg-primary)',
                                transition: 'all 0.2s ease',
                                transform: isDragging ? 'scale(1.02)' : 'scale(1)'
                            }}
                                onClick={() => document.getElementById('ics-upload')?.click()}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <input
                                    type="file"
                                    id="ics-upload"
                                    accept=".ics"
                                    style={{ display: 'none' }}
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
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                    {selectedFile ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                                <line x1="12" y1="18" x2="12" y2="12"></line>
                                                <line x1="9" y1="15" x2="15" y2="15"></line>
                                            </svg>
                                            {selectedFile.name}
                                        </div>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-tertiary)', display: 'block' }}>
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                <polyline points="17 8 12 3 7 8"></polyline>
                                                <line x1="12" y1="3" x2="12" y2="15"></line>
                                            </svg>
                                            <div>Click or drag .ics file to upload</div>
                                        </>
                                    )}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                    Supports standard calendar export files
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (selectedFile ? 'Uploading...' : 'Creating...') : (selectedFile ? 'Upload & Create' : 'Create Semester')}
                        </Button>
                    </div>
                </form>
                    </div>
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
