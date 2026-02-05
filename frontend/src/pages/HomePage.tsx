import React, { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Container } from '../components/Container';
import api from '../services/api';
import type { Program } from '../services/api';
import { useDialog } from '../contexts/DialogContext';

import { useHeroGradient } from '../hooks/useHeroGradient';
import { HomeSkeleton } from '../components/Skeleton/HomeSkeleton';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from '@/components/ui/breadcrumb';

export const HomePage: React.FC = () => {
    const { user } = useAuth();
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

    // Physics-based lighting
    const heroStyle = useHeroGradient();
    const glassButtonClassName =
        "border border-border bg-[color:var(--color-bg-glass)] text-foreground backdrop-blur-md shadow-none hover:bg-[color:var(--color-bg-glass)] hover:text-foreground hover:shadow-md";

    useEffect(() => {
        fetchPrograms();
    }, []);

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
        <Layout>
            <div
                className="hero-section"
                style={{
                    ...heroStyle,
                color: 'var(--color-text-primary)'
            }}>
                <Container>
                    <div className="page-header" style={{ marginBottom: 0 }}>
                        <div>
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
                                    <BreadcrumbPage className="text-primary">Academic</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                            <h1 style={{ fontSize: '3.5rem', margin: 0, fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(to right, var(--color-text-primary), var(--color-text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                Academics
                            </h1>
                            <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', fontSize: '1rem', opacity: 0.8 }}>
                                Welcome back, {user?.nickname || user?.email}
                            </p>
                        </div>
                        <Button
                            onClick={() => setIsModalOpen(true)}
                            size="lg"
                            variant="outline"
                            className={`rounded-full ${glassButtonClassName}`}
                        >
                            + New Program
                        </Button>
                    </div>
                </Container>
            </div>

            <Container padding="3rem 2rem">
                {isLoading ? (
                    <HomeSkeleton />
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '1.5rem'
                    }}>
                        {programs.map(program => (
                            <Link key={program.id} to={`/programs/${program.id}`}>
                                <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                                    <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
                                        <CardTitle className="text-lg">{program.name}</CardTitle>
                                        <Button
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const shouldDelete = await confirm({
                                                    title: "Delete program?",
                                                    description: "Are you sure you want to delete this program?",
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
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </Button>
                                    </CardHeader>
                                    <CardContent className="flex justify-between pt-0">
                                        <div>
                                            <span className="block text-xs text-muted-foreground">CGPA</span>
                                            <span className="text-xl font-semibold">
                                                {program.cgpa_scaled.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xs text-muted-foreground">Credits</span>
                                            <span className="font-medium">
                                                / {program.grad_requirement_credits}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}

                        {programs.length === 0 && (
                            <Empty style={{ gridColumn: '1 / -1' }}>
                                <EmptyHeader>
                                    <EmptyTitle>No programs found</EmptyTitle>
                                    <EmptyDescription>
                                        Start by creating one!
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        )}
                    </div>
                )}
            </Container>

            <Dialog open={isModalOpen} onOpenChange={(open) => !open && setIsModalOpen(false)}>
                <DialogContent className="p-0 sm:max-w-[520px]">
                    <DialogHeader className="border-b px-6 py-4">
                        <DialogTitle className="text-base font-semibold">Create New Program</DialogTitle>
                    </DialogHeader>
                    <div className="p-6">
                <form onSubmit={handleCreateProgram}>
                    <div className="grid gap-2 mb-4">
                        <Label htmlFor={programNameId} className="text-muted-foreground">
                            Program Name
                        </Label>
                        <Input
                            id={programNameId}
                            placeholder="e.g. Computer Science"
                            value={newProgramName}
                            onChange={(e) => setNewProgramName(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>
                    <div className="grid gap-2 mb-4">
                        <Label htmlFor={programCreditsId} className="text-muted-foreground">
                            Graduation Requirement (Credits)
                        </Label>
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
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Creating...' : 'Create Program'}
                        </Button>
                    </div>
                </form>
                    </div>
                </DialogContent>
            </Dialog>
        </Layout>
    );
};
