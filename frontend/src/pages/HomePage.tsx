import React, { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Container } from '../components/Container';
import api from '../services/api';
import type { Program } from '../services/api';
import { useDialog } from '../contexts/DialogContext';

import { HomeSkeleton } from '../components/Skeleton/HomeSkeleton';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Plus, Trash2 } from 'lucide-react';

export const HomePage: React.FC = () => {

    const { alert: showAlert, confirm } = useDialog();
    const [programs, setPrograms] = useState<Program[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // New Program State
    const [newProgramName, setNewProgramName] = useState('');
    const [newProgramCredits, setNewProgramCredits] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const programNameId = useId();
    const programCreditsId = useId();

    useEffect(() => {
        fetchPrograms();
    }, []);

    const breadcrumb = (
        <Breadcrumb>
            <BreadcrumbList className="text-xs font-medium text-muted-foreground">
                <BreadcrumbItem>
                    <BreadcrumbPage className="text-foreground">Academics</BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );

    const fetchPrograms = async () => {
        try {
            const data = await api.getPrograms();
            setPrograms(data);
        } catch (error) {
            console.error("Failed to fetch programs", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateProgram = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.createProgram({
                name: newProgramName,
                grad_requirement_credits: parseFloat(newProgramCredits)
            });
            setIsModalOpen(false);
            setNewProgramName('');
            setNewProgramCredits('');
            fetchPrograms();
        } catch (error) {
            console.error("Failed to create program", error);
            await showAlert({
                title: "Create failed",
                description: "Failed to create program."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Layout breadcrumb={breadcrumb}>
            <div className="border-b bg-background sticky top-[60px] z-20">
                <Container className="py-4 md:py-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Academics</h1>
                            <p className="text-sm text-muted-foreground">
                                Manage your academic programs and track your progress.
                            </p>
                        </div>
                        <Button
                            onClick={() => setIsModalOpen(true)}
                            size="default"
                            className="shadow-sm"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            New Program
                        </Button>
                    </div>
                </Container>
            </div>

            <Container className="py-8 md:py-10">
                {isLoading ? (
                    <HomeSkeleton />
                ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {programs.map(program => (
                            <Link key={program.id} to={`/programs/${program.id}`}>
                                <Card className="group h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md relative">
                                    <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
                                        <CardTitle className="text-lg font-semibold leading-tight line-clamp-1 group-hover:text-primary transition-colors pr-8">
                                            {program.name}
                                        </CardTitle>
                                        <Button
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const shouldDelete = await confirm({
                                                    title: "Delete program?",
                                                    description: "Are you sure you want to delete this program? This action cannot be undone.",
                                                    confirmText: "Delete",
                                                    cancelText: "Cancel",
                                                    tone: "destructive"
                                                });
                                                if (!shouldDelete) return;
                                                api.deleteProgram(program.id)
                                                    .then(fetchPrograms)
                                                    .catch(err => console.error("Failed to delete", err));
                                            }}
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 absolute right-4 top-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
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
                                                    <span className="text-foreground text-base">?</span> {/* We don't have current credits in the list api potentially, checking type */}
                                                    <span className="text-muted-foreground"> / {program.grad_requirement_credits}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}

                        {programs.length === 0 && (
                                <Empty className="col-span-full py-12">
                                <EmptyHeader>
                                        <EmptyTitle>No programs yet</EmptyTitle>
                                    <EmptyDescription>
                                            Create your first academic program to get started.
                                    </EmptyDescription>
                                </EmptyHeader>
                                    <Button onClick={() => setIsModalOpen(true)} className="mt-4">
                                        Create Program
                                    </Button>
                            </Empty>
                        )}
                    </div>
                )}
            </Container>

            <Dialog open={isModalOpen} onOpenChange={(open) => !open && setIsModalOpen(false)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create Program</DialogTitle>
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
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Creating...' : 'Create Program'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Layout>
    );
};
