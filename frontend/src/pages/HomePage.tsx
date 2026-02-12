import React, { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import api from '../services/api';
import type { Program } from '../services/api';
import { useDialog } from '../contexts/DialogContext';

import { ProgramCardSkeleton } from '../components/skeletons';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Plus, Trash2 } from 'lucide-react';

type ShowAlert = ReturnType<typeof useDialog>['alert'];

type CreateProgramDialogButtonProps = {
    showAlert: ShowAlert;
    onCreated: () => Promise<void>;
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
    const programNameId = useId();
    const programCreditsId = useId();

    const handleCreateProgram = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
            await api.createProgram({
                name: newProgramName,
                grad_requirement_credits: parseFloat(newProgramCredits),
                program_timezone: timezone,
            });
            setOpen(false);
            setNewProgramName('');
            setNewProgramCredits('');
            await onCreated();
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
                onClick={() => setOpen(true)}
            >
                {children}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create Program</DialogTitle>
                        <DialogDescription>
                            Enter a program name and graduation requirement credits.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateProgram} className="space-y-4 py-4">
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
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Creating...' : 'Create Program'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
};

type DeleteProgramButtonProps = {
    programId: string;
    onDeleted: () => Promise<void>;
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
            await onDeleted();
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

export const HomePage: React.FC = () => {
    const { alert: showAlert } = useDialog();
    const [programs, setPrograms] = useState<Program[]>([]);
    const [programEarnedCredits, setProgramEarnedCredits] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState(true);

    const fetchPrograms = useCallback(async () => {
        try {
            const data = await api.getPrograms();
            setPrograms(data);
            const creditEntries = await Promise.all(
                data.map(async (program) => {
                    try {
                        const details = await api.getProgram(program.id);
                        const earnedCredits = details.semesters.reduce((semesterSum, semester) => {
                            const semesterCredits = (semester.courses || []).reduce((courseSum, course) => courseSum + course.credits, 0);
                            return semesterSum + semesterCredits;
                        }, 0);
                        return [program.id, earnedCredits] as const;
                    } catch {
                        return [program.id, 0] as const;
                    }
                })
            );
            setProgramEarnedCredits(Object.fromEntries(creditEntries));
        } catch (error) {
            console.error("Failed to fetch programs", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchPrograms();
    }, [fetchPrograms]);

    const breadcrumb = (
        <Breadcrumb>
            <BreadcrumbList className="text-xs font-medium text-muted-foreground">
                <BreadcrumbItem>
                    <BreadcrumbPage className="text-foreground">Academics</BreadcrumbPage>
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
                            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Academics</h1>
                            <p className="text-sm text-muted-foreground">
                                Manage your academic programs and track your progress.
                            </p>
                        </div>
                        <CreateProgramDialogButton
                            showAlert={showAlert}
                            onCreated={fetchPrograms}
                            size="default"
                            className="shadow-sm"
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
                                <Link to={`/programs/${program.id}`} className="block h-full">
                                    <Card className="h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-lg font-semibold leading-tight line-clamp-1 group-hover:text-primary transition-colors pr-8">
                                                {program.name}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="block text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">CGPA</span>
                                                    <span className="text-xl font-bold tracking-tight">
                                                        {program.cgpa_scaled.toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">Credits</span>
                                                    <span className="text-sm font-medium">
                                                        <span className="text-foreground text-base">{(programEarnedCredits[program.id] || 0).toFixed(1)}</span>
                                                        <span className="text-muted-foreground"> / {program.grad_requirement_credits}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                                <div className="absolute right-4 top-4 z-20">
                                        <DeleteProgramButton
                                            programId={program.id}
                                            onDeleted={fetchPrograms}
                                            showAlert={showAlert}
                                        />
                                </div>
                            </div>
                        ))}

                        {programs.length === 0 && (
                            <Empty className="col-span-full py-12">
                                <EmptyHeader>
                                    <EmptyTitle>No programs yet</EmptyTitle>
                                    <EmptyDescription>
                                        Create your first academic program to get started.
                                    </EmptyDescription>
                                </EmptyHeader>
                                <CreateProgramDialogButton
                                    showAlert={showAlert}
                                    onCreated={fetchPrograms}
                                    className="mt-4"
                                >
                                    Create Program
                                </CreateProgramDialogButton>
                            </Empty>
                        )}
                    </div>
                )}
            </Container>
        </Layout>
    );
};
