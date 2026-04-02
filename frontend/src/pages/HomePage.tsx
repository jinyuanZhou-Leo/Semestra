// input:  [program list/create/delete APIs, app-side Program resource hooks/cache helpers, auth active-Program state, dialog context, route links, loading skeletons, responsive overlay wrapper, shared business empty-state wrappers, and shadcn scroll-area]
// output: [`ProgramsPage` plus local create/delete/activate program flows and responsive create surface components]
// pos:    [Secondary account-level Programs browser that lets users create, switch, and delete Programs while deriving Program list/detail server state from TanStack Query caches]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useCallback, useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';

import { AppEmptyState } from '../components/AppEmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
    getProgramsListQueryOptions,
    invalidateProgramsListQuery,
    removeProgramDetailQuery,
    useProgramDetailQueries,
    useProgramsListQuery,
} from '@/data/resources';
import api from '../services/api';
import type { Program } from '../services/api';
import { useDialog } from '../contexts/DialogContext';
import { useAuth } from '../contexts/AuthContext';

import { ProgramCardSkeleton } from '../components/skeletons';
import { AnimatedNumber } from '../components/AnimatedNumber';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Plus, Trash2 } from 'lucide-react';
import { ResponsiveDialogDrawer } from '../components/ResponsiveDialogDrawer';

type ShowAlert = ReturnType<typeof useDialog>['alert'];

type CreateProgramDialogButtonProps = {
    showAlert: ShowAlert;
    onCreated: (program: Program) => Promise<void>;
    className?: string;
    size?: React.ComponentProps<typeof Button>['size'];
    variant?: React.ComponentProps<typeof Button>['variant'];
    children: React.ReactNode;
};

const CreateProgramDialogButton: React.FC<CreateProgramDialogButtonProps> = ({
    showAlert,
    onCreated,
    className,
    size,
    variant,
    children,
}) => {
    const [open, setOpen] = useState(false);
    const [newProgramName, setNewProgramName] = useState('');
    const [newProgramCredits, setNewProgramCredits] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const createProgramFormId = useId();
    const programNameId = useId();
    const programCreditsId = useId();

    const handleCreateProgram = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
            const createdProgram = await api.createProgram({
                name: newProgramName,
                grad_requirement_credits: parseFloat(newProgramCredits),
                program_timezone: timezone,
            });
            setOpen(false);
            setNewProgramName('');
            setNewProgramCredits('');
            await onCreated(createdProgram);
        } catch (error) {
            console.error("Failed to create program", error);
            await showAlert({
                title: "Create failed",
                description: "Failed to create program."
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [newProgramCredits, newProgramName, onCreated, showAlert]);

    return (
        <>
            <Button
                type="button"
                size={size}
                variant={variant}
                className={className}
                onClick={(e) => {
                    e.currentTarget.blur();
                    setOpen(true);
                }}
            >
                {children}
            </Button>
            <ResponsiveDialogDrawer
                open={open}
                onOpenChange={setOpen}
                title="Create Program"
                description="Enter a program name and graduation requirement credits."
                desktopContentClassName="sm:max-w-[425px]"
                mobileHeaderClassName="text-left"
                footer={(
                    <>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" form={createProgramFormId} disabled={isSubmitting}>
                            {isSubmitting ? 'Creating...' : 'Create Program'}
                        </Button>
                    </>
                )}
                mobileFooterClassName="pt-2"
            >
                <form
                    id={createProgramFormId}
                    onSubmit={handleCreateProgram}
                    className="grid gap-4 px-4 md:px-0"
                >
                    <div className="grid gap-2">
                        <Label htmlFor={programNameId}>Program Name</Label>
                        <Input
                            id={programNameId}
                            placeholder="e.g. Computer Science"
                            value={newProgramName}
                            onChange={(e) => setNewProgramName(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor={programCreditsId}>Graduation Requirement (Credits)</Label>
                        <Input
                            id={programCreditsId}
                            type="number"
                            step="0.5"
                            placeholder="e.g. 120"
                            value={newProgramCredits}
                            onChange={(e) => setNewProgramCredits(e.target.value)}
                            required
                        />
                    </div>
                </form>
            </ResponsiveDialogDrawer>
        </>
    );
};

type DeleteProgramButtonProps = {
    programId: string;
    onDeleted: (programId: string) => Promise<void>;
    showAlert: ShowAlert;
};

const DeleteProgramButton: React.FC<DeleteProgramButtonProps> = ({ programId, onDeleted, showAlert }) => {
    const [open, setOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteProgram = useCallback(async () => {
        setIsDeleting(true);
        try {
            await api.deleteProgram(programId);
            setOpen(false);
            await onDeleted(programId);
        } catch (error) {
            console.error("Failed to delete program", error);
            await showAlert({
                title: "Delete failed",
                description: "Failed to delete program."
            });
        } finally {
            setIsDeleting(false);
        }
    }, [onDeleted, programId, showAlert]);

    return (
        <>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isDeleting) {
                        setOpen(true);
                    }
                }}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
            <AlertDialog open={open} onOpenChange={(nextOpen) => !isDeleting && setOpen(nextOpen)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete program?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete this program? This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={handleDeleteProgram} disabled={isDeleting}>
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export const ProgramsPage: React.FC = () => {
    const { alert: showAlert } = useDialog();
    const { user, setActiveProgram } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const programsQuery = useProgramsListQuery();
    const programs = programsQuery.data ?? [];
    const programDetailsQueries = useProgramDetailQueries(programs.map((program) => program.id));
    const isProgramCreditsLoading = programDetailsQueries.some((query) => !query.data && !query.error);
    const isLoading = programsQuery.isLoading || isProgramCreditsLoading;

    const programEarnedCredits = useMemo<Record<string, number>>(() => {
        return Object.fromEntries(
            programs.map((program, index) => {
                const details = programDetailsQueries[index]?.data;
                const earnedCredits = details
                    ? details.semesters.reduce((semesterSum, semester) => {
                        const semesterCredits = (semester.courses || []).reduce((courseSum, course) => courseSum + course.credits, 0);
                        return semesterSum + semesterCredits;
                    }, 0)
                    : 0;
                return [program.id, earnedCredits];
            }),
        );
    }, [programDetailsQueries, programs]);

    const handleActivateProgram = useCallback(async (programId: string) => {
        try {
            await setActiveProgram(programId);
            navigate(`/programs/${programId}`);
        } catch (error) {
            console.error('Failed to activate program', error);
            await showAlert({
                title: 'Switch failed',
                description: 'Failed to switch the active Program.',
            });
        }
    }, [navigate, setActiveProgram, showAlert]);

    const handleCreatedProgram = useCallback(async (program: Program) => {
        void invalidateProgramsListQuery(queryClient);
        try {
            await setActiveProgram(program.id);
            navigate(`/programs/${program.id}`);
        } catch (error) {
            console.error('Failed to activate created program', error);
            await showAlert({
                title: 'Switch failed',
                description: 'Failed to switch the active Program.',
            });
        }
    }, [navigate, queryClient, setActiveProgram, showAlert]);

    const handleDeletedProgram = useCallback(async (deletedProgramId: string) => {
        await invalidateProgramsListQuery(queryClient);
        removeProgramDetailQuery(queryClient, deletedProgramId);
        const nextPrograms = await queryClient.fetchQuery(getProgramsListQueryOptions());

        if (user?.active_program_id !== deletedProgramId) {
            return;
        }

        const fallbackProgram = nextPrograms[0] ?? null;
        await setActiveProgram(fallbackProgram?.id ?? null);
        if (fallbackProgram) {
            navigate(`/programs/${fallbackProgram.id}`);
        }
    }, [navigate, queryClient, setActiveProgram, user?.active_program_id]);

    const breadcrumb = (
        <Breadcrumb>
            <BreadcrumbList className="text-xs font-medium text-muted-foreground">
                    <BreadcrumbItem>
                    <BreadcrumbPage className="text-foreground">Programs</BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );

    return (
        <Layout breadcrumb={breadcrumb}>
            <div className="sticky-page-header border-b bg-background sticky top-[60px] z-20">
                <Container className="py-4 md:py-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Programs</h1>
                            <p className="text-sm text-muted-foreground">
                                Switch the active Program or create a new one.
                            </p>
                        </div>
                        <CreateProgramDialogButton
                            showAlert={showAlert}
                            onCreated={handleCreatedProgram}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            New Program
                        </CreateProgramDialogButton>
                    </div>
                </Container>
            </div>

            <Container className="py-8 md:py-10">
                {isLoading ? (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <ProgramCardSkeleton key={i} />
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {programs.map(program => (
                            <div key={program.id} className="group relative">
                                <Link
                                    to={`/programs/${program.id}`}
                                    className="block h-full"
                                    onClick={async (event) => {
                                        event.preventDefault();
                                        await handleActivateProgram(program.id);
                                    }}
                                >
                                    <Card className="h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between gap-3 pr-8">
                                                <CardTitle className="text-lg font-semibold leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                                                    {program.name}
                                                </CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="mb-1 block text-xs font-medium tracking-wider text-muted-foreground">CGPA</span>
                                                    <span className="text-xl font-bold tracking-tight">
                                                        <AnimatedNumber
                                                            value={program.cgpa_scaled}
                                                            format={(val) => val.toFixed(2)}
                                                        />
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="mb-1 block text-xs font-medium tracking-wider text-muted-foreground">Credits</span>
                                                    <span className="text-sm font-medium">
                                                        <span className="text-base text-foreground">{(programEarnedCredits[program.id] || 0).toFixed(1)}</span>
                                                        <span className="text-muted-foreground"> / {program.grad_requirement_credits}</span>
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="rounded-md border border-border/70 px-3 py-2 text-center text-sm font-medium text-foreground">
                                                Switch to workspace
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                                <div className="absolute right-4 top-4">
                                        <DeleteProgramButton
                                            programId={program.id}
                                            onDeleted={handleDeletedProgram}
                                            showAlert={showAlert}
                                        />
                                </div>
                            </div>
                        ))}

                        {programs.length === 0 && (
                            <AppEmptyState
                                scenario="create"
                                size="section"
                                className="col-span-full py-12"
                                title="No programs yet"
                                description="Create your first academic Program to start using Program Home."
                                primaryAction={(
                                    <CreateProgramDialogButton
                                    showAlert={showAlert}
                                    onCreated={handleCreatedProgram}
                                    >
                                        Create Program
                                    </CreateProgramDialogButton>
                                )}
                            />
                        )}
                    </div>
                )}
            </Container>
        </Layout>
    );
};

export const HomePage = ProgramsPage;
