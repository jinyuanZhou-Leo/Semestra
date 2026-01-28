import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Container } from './Container';

interface LayoutProps {
    children: React.ReactNode;
    disableAutoHide?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, disableAutoHide = false }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

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

    React.useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

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
                zIndex: 1000,
                transition: 'transform 0.3s ease-in-out',
                transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
            }}>

                <Container className="layout-header-content" style={{ height: '100%' }}>
                    <Link to="/" style={{ fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--color-text-primary)', textDecoration: 'none' }}>
                        Semestra
                    </Link>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {!isOnline && (
                            <div
                                className="offline-indicator user-selected"
                                title="Offline: sync unavailable"
                                aria-label="Offline: sync unavailable"
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.7 1.2A3.5 3.5 0 0 1 17 18H7z" />
                                    <line x1="4" y1="4" x2="20" y2="20" />
                                </svg>
                                <span>Offline</span>
                            </div>
                        )}

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
                    </div>
                </Container>
            </header>
            <main style={{ flex: 1, paddingTop: '60px' }}>
                {children}
            </main>
        </div>
    );
};
