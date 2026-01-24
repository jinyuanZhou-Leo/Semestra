import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Container } from './Container';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
        }}>
            <header style={{
                height: '60px',
                borderBottom: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-primary)',
            }}>
                <Container style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Link to="/" style={{ fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--color-text-primary)', textDecoration: 'none' }}>
                        Semestra
                    </Link>

                {user && (
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: 'var(--color-accent-primary)',
                                color: 'var(--color-accent-text)',
                                border: 'none',
                                fontWeight: 'bold',
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {user.email.charAt(0).toUpperCase()}
                        </button>

                        {isMenuOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '0.5rem',
                                background: 'var(--color-bg-primary)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                boxShadow: 'var(--shadow-md)',
                                minWidth: '150px',
                                zIndex: 100
                            }}>
                                <div
                                    onClick={() => navigate('/settings')}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        cursor: 'pointer',
                                        borderBottom: '1px solid var(--color-border)',
                                        color: 'var(--color-text-primary)'
                                    }}
                                >
                                    Settings
                                </div>
                                <div
                                        onClick={() => {
                                        navigate('/settings');
                                    }}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        cursor: 'pointer',
                                        color: 'var(--color-text-primary)'
                                    }}
                                >
                                    Profile
                                </div>
                                    <div
                                        onClick={() => {
                                            localStorage.removeItem('token');
                                            window.location.href = '/login';
                                        }}
                                        style={{
                                            padding: '0.75rem 1rem',
                                            cursor: 'pointer',
                                            color: 'var(--color-error)',
                                            borderTop: '1px solid var(--color-border)'
                                        }}
                                    >
                                        Sign out
                                    </div>
                            </div>
                        )}
                        {/* Click outside listener would be nice but skipping for mvp */}
                    </div>
                )}
                </Container>
            </header>
            <main style={{ flex: 1 }}>
                {children}
            </main>
        </div>
    );
};
