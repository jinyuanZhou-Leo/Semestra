import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import api from '../services/api';
import type { Program } from '../services/api';

export const HomePage: React.FC = () => {
    const { user } = useAuth();
    const [programs, setPrograms] = useState<Program[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // New Program State
    const [newProgramName, setNewProgramName] = useState('');
    const [newProgramCredits, setNewProgramCredits] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            alert('Failed to create program');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Layout>
            <div style={{ padding: '2rem 3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Academics</h1>
                        <p style={{ color: 'var(--color-text-secondary)' }}>
                            Logged in as {user?.email}
                        </p>
                    </div>
                    <Button onClick={() => setIsModalOpen(true)}>
                        + New Program
                    </Button>
                </div>

                {isLoading ? (
                    <div>Loading...</div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '1.5rem'
                    }}>
                        {programs.map(program => (
                            <Link key={program.id} to={`/programs/${program.id}`}>
                                <div style={{
                                    padding: '1.5rem',
                                    borderRadius: 'var(--radius-lg)',
                                    backgroundColor: 'var(--color-bg-primary)',
                                    boxShadow: 'var(--shadow-sm)',
                                    border: '1px solid var(--color-border)',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    cursor: 'pointer',
                                    position: 'relative'
                                }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{program.name}</h3>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (window.confirm('Are you sure you want to delete this program?')) {
                                                    api.deleteProgram(program.id).then(fetchPrograms).catch(err => console.error("Failed to delete", err));
                                                }
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--color-text-secondary)',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                borderRadius: '4px',
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                                        <div>
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>CGPA</span>
                                            <span style={{ fontWeight: 600, fontSize: '1.25rem' }}>
                                                {program.cgpa_scaled.toFixed(2)}
                                            </span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Credits</span>
                                            <span style={{ fontWeight: 500 }}>
                                                / {program.grad_requirement_credits}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}

                        {programs.length === 0 && (
                            <div style={{
                                gridColumn: '1 / -1',
                                textAlign: 'center',
                                padding: '4rem',
                                color: 'var(--color-text-secondary)',
                                border: '2px dashed var(--color-border)',
                                borderRadius: 'var(--radius-lg)'
                            }}>
                                No programs found. Start by creating one!
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Create New Program"
            >
                <form onSubmit={handleCreateProgram}>
                    <Input
                        label="Program Name"
                        placeholder="e.g. Computer Science"
                        value={newProgramName}
                        onChange={(e) => setNewProgramName(e.target.value)}
                        required
                        autoFocus
                    />
                    <Input
                        label="Graduation Requirement (Credits)"
                        type="number"
                        step="0.5"
                        placeholder="e.g. 120"
                        value={newProgramCredits}
                        onChange={(e) => setNewProgramCredits(e.target.value)}
                        required
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Creating...' : 'Create Program'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </Layout>
    );
};
