import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppStatus } from '../hooks/useAppStatus';
import { Container } from './Container';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';

interface LayoutProps {
    children: React.ReactNode;
    disableAutoHide?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, disableAutoHide = false }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { status, clearStatus } = useAppStatus();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const isSyncStatus = status?.type === 'error' && /sync/i.test(status.message);
    const isSyncRetrying = Boolean(isSyncStatus && /retrying/i.test(status?.message ?? ''));
    const lastToastIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (!status || !isSyncStatus) return;
        if (lastToastIdRef.current === status.id) return;
        lastToastIdRef.current = status.id;
        if (isSyncRetrying) {
            toast.message(status.message, {
                icon: <Spinner className="size-3 text-destructive" />,
                duration: 4000,
            });
        } else {
            toast.error(status.message, {
                duration: Infinity,
                onDismiss: clearStatus,
                icon: (
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                ),
                action: {
                    label: "Dismiss",
                    onClick: clearStatus,
                },
            });
        }
    }, [clearStatus, isSyncRetrying, isSyncStatus, status]);

    // Initialize theme from localStorage on mount
    React.useEffect(() => {
        const saved = localStorage.getItem('themePreference');
        if (saved === 'light' || saved === 'dark') {
            document.documentElement.setAttribute('data-theme', saved);
        } else if (saved === 'system' || !saved) {
            // Follow system preference
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', systemTheme);

            // Listen for system theme changes when in system mode
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = (e: MediaQueryListEvent) => {
                const currentPref = localStorage.getItem('themePreference');
                if (currentPref === 'system' || !currentPref) {
                    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
                }
            };
            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
        }
    }, []);

    // Page Blur Logic
    const [isPageBlurred, setIsPageBlurred] = useState(false);

    // Navbar Auto-hide Logic
    const [isVisible, setIsVisible] = useState(true);
    const lastScrollY = React.useRef(0);

    React.useEffect(() => {
        if (disableAutoHide) {
            setIsVisible(true);
            return;
        }

        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // Show if at top
            if (currentScrollY < 10) {
                setIsVisible(true);
            }
            // Hide if scrolling down and past navbar height
            else if (currentScrollY > lastScrollY.current && currentScrollY > 60) {
                setIsVisible(false);
            }
            // Show if scrolling up
            else if (currentScrollY < lastScrollY.current) {
                setIsVisible(true);
            }

            lastScrollY.current = currentScrollY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [disableAutoHide]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
        }}>
            <header style={{
                height: '60px',
                borderBottom: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-glass)', // Transparent/Glass background
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 'var(--z-header)',
                transition: 'transform 0.3s ease-in-out',
                transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
            }}>

                <Container className="layout-header-content" style={{ height: '100%' }}>
                    <Link to="/" style={{ fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--color-text-primary)', textDecoration: 'none' }}>
                        Semestra
                    </Link>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                            onClick={() => setIsPageBlurred(!isPageBlurred)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--color-text-tertiary)',
                                padding: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                transition: 'background-color 0.2s, color 0.2s',
                            }}
                            title={isPageBlurred ? "Unblur page" : "Blur page"}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                                e.currentTarget.style.color = 'var(--color-text-secondary)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'var(--color-text-tertiary)';
                            }}
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                {isPageBlurred ? (
                                    <>
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                        <line x1="1" y1="1" x2="23" y2="23" />
                                    </>
                                ) : (
                                    <>
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </>
                                )}
                            </svg>
                        </button>

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
                                    <div
                                        className="fade-in-down"
                                        style={{
                                            position: 'absolute',
                                            top: 'calc(100% + 10px)',
                                            right: 0,
                                            background: 'var(--color-bg-primary)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 'var(--radius-lg)',
                                            boxShadow: 'var(--shadow-lg)',
                                            minWidth: '200px',
                                            zIndex: 100,
                                            overflow: 'hidden',
                                            padding: '0.25rem'
                                        }}
                                    >
                                        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', marginBottom: '0.25rem' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                                                {user.nickname || 'User'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {user.email}
                                            </div>
                                        </div>
                                        <div
                                            onClick={() => navigate('/settings')}
                                            style={{
                                                padding: '0.6rem 1rem',
                                                cursor: 'pointer',
                                                color: 'var(--color-text-primary)',
                                                fontSize: '0.9rem',
                                                borderRadius: 'var(--radius-sm)',
                                                transition: 'background-color 0.2s',
                                                margin: '0 0.25rem'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            Settings
                                        </div>
                                        <div
                                            onClick={() => {
                                                localStorage.removeItem('token');
                                                window.location.href = '/login';
                                            }}
                                            style={{
                                                padding: '0.6rem 1rem',
                                                cursor: 'pointer',
                                                color: 'var(--color-danger)',
                                                fontSize: '0.9rem',
                                                borderRadius: 'var(--radius-sm)',
                                                transition: 'background-color 0.2s',
                                                margin: '0.25rem 0.25rem 0.25rem 0.25rem'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            Sign out
                                        </div>
                                    </div>
                                )}
                                {/* Click outside listener would be nice but skipping for mvp */}
                            </div>
                        )}
                    </div>
                </Container>
            </header>
            <main style={{
                flex: 1,
                paddingTop: '60px',
                transition: 'filter 0.3s ease',
                filter: isPageBlurred ? 'blur(10px)' : 'none'
            }}>
                {children}
            </main>
        </div>
    );
};
