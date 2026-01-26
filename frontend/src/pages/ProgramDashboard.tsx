import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { SettingsModal } from '../components/SettingsModal';
import { Input } from '../components/Input';
import { Container } from '../components/Container';
import api from '../services/api';
import type { Program, Semester } from '../services/api';
import { BackButton } from '../components/BackButton';
import { useHeroGradient } from '../hooks/useHeroGradient';
import { ProgressBar } from '../components/ProgressBar';

export const ProgramDashboard: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [program, setProgram] = useState<(Program & { semesters: Semester[] }) | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newSemesterName, setNewSemesterName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [creationMethod, setCreationMethod] = useState<'manual' | 'upload'>('manual');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.name.endsWith('.ics') || file.type === 'text/calendar') {
                setSelectedFile(file);
                // Auto-fill name from filename only if name is empty
                if (!newSemesterName) {
                    const name = file.name.replace('.ics', '').replace(/[_-]/g, ' ');
                    setNewSemesterName(name);
                }
                else {
                    setNewSemesterName(newSemesterName);
                }
            } else {
                alert('Please upload a valid .ics file');
            }
        }
    };

    // Settings Modal State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const heroStyle = useHeroGradient();

    useEffect(() => {
        if (id) fetchProgram(id);
    }, [id]);

    const fetchProgram = async (programId: string) => {
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
        return (
            <Layout>
                <Container>
                    <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                        <h2 style={{ marginBottom: '1rem' }}>Program not found</h2>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
                            The program you are looking for does not exist or has been deleted.
                        </p>
                        <Link to="/">
                            <Button>Back to Home</Button>
                        </Link>
                    </div>
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
                color: 'var(--color-text-primary)'
            }}>
                <Container>
                    <BackButton to="/" label="Back to Programs" />
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-primary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Program Overview</div>
                    <div className="page-header" style={{ marginBottom: '2.5rem' }}>
                        <h1 className="noselect text-truncate" style={{ fontSize: '3.5rem', margin: 0, fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(to right, var(--color-text-primary), var(--color-text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            {program.name}
                        </h1>
                        <Button
                            variant="glass"
                            shape="circle"
                            onClick={() => setIsSettingsOpen(true)}
                            size="md"
                            title="Program Settings"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                        </Button>
                    </div>

                    <div className="program-stats-grid">
                        <div className="noselect program-stat-card">
                            <div className="program-stat-label">
                                <span className="program-stat-label-text">CGPA (Scaled)</span>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleUpdateProgram({ hide_gpa: !program.hide_gpa });
                                    }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--color-text-secondary)',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        flexShrink: 0
                                    }}
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
                                </button>
                            </div>
                            <div className="program-stat-value primary">
                                {program.hide_gpa ? '****' : program.cgpa_scaled.toFixed(2)}
                            </div>
                        </div>
                        <div className="noselect program-stat-card">
                            <div className="program-stat-label">Average (%)</div>
                            <div className="program-stat-value">
                                {program.hide_gpa ? '****' : program.cgpa_percentage.toFixed(1)}
                                {!program.hide_gpa && <span className="program-stat-unit">%</span>}
                            </div>
                        </div>
                        <div className="noselect program-stat-card">
                            <div className="program-stat-label">Credits Progress</div>
                            <div className="program-stat-value" style={{ marginBottom: '0.5rem' }}>
                                {program.semesters.reduce((acc, sem: any) => acc + (sem.courses?.reduce((cAcc: number, c: any) => cAcc + c.credits, 0) || 0), 0)}
                                <span className="program-stat-unit small"> / {program.grad_requirement_credits}</span>
                            </div>
                            <ProgressBar
                                value={program.semesters.reduce((acc, sem: any) => acc + (sem.courses?.reduce((cAcc: number, c: any) => cAcc + c.credits, 0) || 0), 0)}
                                max={program.grad_requirement_credits}
                                height="8px"
                            />
                        </div>
                    </div>
                </Container>
            </div>

            <Container padding="3rem 2rem">
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
                    {program.semesters.map(semester => (
                        <Link key={semester.id} to={`/semesters/${semester.id}`}>
                            <div className="noselect" style={{
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
                                    <h3 className='text-truncate' style={{ fontSize: '1.5rem', margin: 0 }}>{semester.name}</h3>
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
                                    <div className='text-truncate' style={{ fontWeight: 600 }}>{course.name}</div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{course.grade_scaled.toFixed(2)}</div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </Container>

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
                                                if (!newSemesterName) {
                                                    const name = file.name.replace('.ics', '').replace(/[_-]/g, ' ');
                                                    setNewSemesterName(name);
                                                }
                                            }
                                        }}
                                />
                                <div style={{ marginBottom: '0.5rem' }}>
                                        {selectedFile ? (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                    <polyline points="14 2 14 8 20 8"></polyline>
                                                    <line x1="12" y1="18" x2="12" y2="12"></line>
                                                    <line x1="9" y1="15" x2="15" y2="15"></line>
                                                </svg>
                                                {selectedFile.name}
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ marginBottom: '0.5rem' }}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-tertiary)' }}>
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                        <polyline points="17 8 12 3 7 8"></polyline>
                                                        <line x1="12" y1="3" x2="12" y2="15"></line>
                                                    </svg>
                                                </div>
                                                <div>Click or drag .ics file here</div>
                                            </>
                                        )}
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
                        gpa_scaling_table: program.gpa_scaling_table,
                        hide_gpa: program.hide_gpa
                    }}
                    onSave={handleUpdateProgram}
                    type="program"
                />
            )}
        </Layout>
    );
};
