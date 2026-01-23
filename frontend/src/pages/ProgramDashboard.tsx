import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { SettingsModal } from '../components/SettingsModal';
import { Input } from '../components/Input';
import api from '../services/api';
import type { Program, Semester } from '../services/api';
import { BackButton } from '../components/BackButton';

export const ProgramDashboard: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [program, setProgram] = useState<Program & { semesters: Semester[] } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newSemesterName, setNewSemesterName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [creationMethod, setCreationMethod] = useState<'manual' | 'upload'>('manual');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Settings Modal State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        if (id) fetchProgram(parseInt(id));
    }, [id]);

    const fetchProgram = async (programId: number) => {
        try {
            const data = await api.getProgram(programId);
            setProgram(data);
        } catch (error) {
            console.error("Failed to fetch program", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateSemester = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!program) return;

        setIsSubmitting(true);
        try {
            if (creationMethod === 'manual') {
                await api.createSemester(program.id, {
                    name: newSemesterName
                });
            } else {
                if (!selectedFile) {
                    alert("Please select a file to upload");
                    setIsSubmitting(false);
                    return;
                }
                await api.uploadSemesterICS(program.id, selectedFile, newSemesterName || undefined);
            }
            setIsModalOpen(false);
            setNewSemesterName('');
            setSelectedFile(null);
            setCreationMethod('manual');
            fetchProgram(program.id);
        } catch (error) {
            console.error("Failed to create semester", error);
            alert('Failed to create semester');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateProgram = async (data: any) => {
        if (!program) return;
        try {
            await api.updateProgram(program.id, data);
            fetchProgram(program.id);
        } catch (error) {
            console.error("Failed to update program", error);
            alert("Failed to update program");
        }
    };

    if (isLoading) {
        return <Layout><div style={{ padding: '2rem' }}>Loading...</div></Layout>;
    }

    if (!program) {
        return <Layout><div style={{ padding: '2rem' }}>Program not found</div></Layout>;
    }


    return (
        <Layout>
            <div style={{
                background: 'var(--gradient-hero)',
                padding: '4rem 2rem',
                color: 'var(--color-text-primary)'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <BackButton to="/" label="Back to Programs" />
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-primary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Program Overview</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
                        <h1 style={{ fontSize: '3.5rem', margin: 0, fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(to right, var(--color-text-primary), var(--color-text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            {program.name}
                        </h1>
                        <Button
                            variant="secondary"
                            onClick={() => setIsSettingsOpen(true)}
                            style={{ backdropFilter: 'blur(10px)', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.05)' }}
                        >
                            Settings
                        </Button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.6)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(0,0,0,0.05)' }}>
                            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>CGPA (Scaled)</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{program.cgpa_scaled.toFixed(2)}</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.6)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(0,0,0,0.05)' }}>
                            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Average (%)</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 700 }}>{program.cgpa_percentage.toFixed(1)}<span style={{ fontSize: '1.5rem', color: 'var(--color-text-secondary)' }}>%</span></div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.6)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(0,0,0,0.05)' }}>
                            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Credits Progress</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 700 }}>
                                {program.semesters.reduce((acc, sem: any) => acc + (sem.courses?.reduce((cAcc: number, c: any) => cAcc + c.credits, 0) || 0), 0)}
                                <span style={{ fontSize: '1.25rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}> / {program.grad_requirement_credits}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.75rem' }}>Semesters</h2>
                    <Button onClick={() => setIsModalOpen(true)}>+ New Semester</Button>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '2rem',
                    marginBottom: '4rem'
                }}>
                    {program.semesters.map(semester => (
                        <Link key={semester.id} to={`/semesters/${semester.id}`}>
                            <div style={{
                                padding: '2rem',
                                borderRadius: 'var(--radius-lg)',
                                backgroundColor: 'var(--color-bg-primary)',
                                boxShadow: 'var(--shadow-sm)',
                                border: '1px solid var(--color-border)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease-in-out',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem',
                                height: '100%',
                                position: 'relative'
                            }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{semester.name}</h3>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: semester.average_scaled >= 3.0 ? '#10b981' : '#f59e0b' }}></div>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (window.confirm('Are you sure you want to delete this semester?')) {
                                                    api.deleteSemester(semester.id).then(() => fetchProgram(program.id)).catch(err => console.error("Failed to delete", err));
                                                }
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--color-text-secondary)',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                borderRadius: '4px',
                                                marginLeft: '0.5rem'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>GPA</div>
                                        <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{semester.average_scaled.toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AVG</div>
                                        <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{semester.average_percentage.toFixed(1)}%</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Courses</div>
                                        <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{(semester as any).courses?.length || 0}</div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}

                    {program.semesters.length === 0 && ( /* ... Empty state ... */
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>No semesters found.</div>
                    )}
                </div>

                {/* Course List Section */}
                <div style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>All Courses</h2>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                        gap: '1.5rem'
                    }}>
                        {program.semesters.flatMap((s: any) => s.courses || []).map((course: any) => (
                            <Link key={course.id} to={`/courses/${course.id}`}>
                                <div style={{
                                    padding: '1.5rem',
                                    borderRadius: 'var(--radius-md)',
                                    backgroundColor: 'var(--color-bg-primary)',
                                    border: '1px solid var(--color-border)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'border-color 0.2s'
                                }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
                                >
                                    <div style={{ fontWeight: 600 }}>{course.name}</div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{course.grade_scaled.toFixed(2)}</div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Create New Semester"
            >
                <form onSubmit={handleCreateSemester}>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: 'var(--color-bg-secondary)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
                        <Button
                            type="button"
                            variant={creationMethod === 'manual' ? 'primary' : 'secondary'}
                            onClick={() => setCreationMethod('manual')}
                            style={{ flex: 1 }}
                        >
                            Manual
                        </Button>
                        <Button
                            type="button"
                            variant={creationMethod === 'upload' ? 'primary' : 'secondary'}
                            onClick={() => setCreationMethod('upload')}
                            style={{ flex: 1 }}
                        >
                            Upload ICS
                        </Button>
                    </div>

                    {creationMethod === 'manual' ? (
                        <Input
                            label="Semester Name"
                            placeholder="e.g. Fall 2025"
                            value={newSemesterName}
                            onChange={(e) => setNewSemesterName(e.target.value)}
                            required
                            autoFocus
                        />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{
                                border: '2px dashed var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                padding: '2rem',
                                textAlign: 'center',
                                cursor: 'pointer',
                                background: 'var(--color-bg-primary)'
                            }}
                                onClick={() => document.getElementById('ics-upload')?.click()}
                            >
                                <input
                                    type="file"
                                    id="ics-upload"
                                    accept=".ics"
                                    style={{ display: 'none' }}
                                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                />
                                <div style={{ marginBottom: '0.5rem' }}>
                                    {selectedFile ? selectedFile.name : 'Click to select .ics file'}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                    Supports standard calendar export files
                                </div>
                            </div>
                            <Input
                                label="Semester Name (Optional)"
                                placeholder="Auto-generated from filename if empty"
                                value={newSemesterName}
                                onChange={(e) => setNewSemesterName(e.target.value)}
                            />
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (creationMethod === 'upload' ? 'Uploading...' : 'Creating...') : (creationMethod === 'upload' ? 'Upload & Create' : 'Create Semester')}
                        </Button>
                    </div>
                </form>
            </Modal>

            {program && (
                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    title="Program Settings"
                    initialName={program.name}
                    initialSettings={{
                        grad_requirement_credits: program.grad_requirement_credits,
                        gpa_scaling_table: program.gpa_scaling_table
                    }}
                    onSave={handleUpdateProgram}
                    type="program"
                />
            )}
        </Layout>
    );
};
