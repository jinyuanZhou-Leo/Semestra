import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { GPAScalingTable } from '../components/GPAScalingTable';
import axios from 'axios';

import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { Container } from '../components/Container';
import { SettingsSection } from '../components/SettingsSection';
import api from '../services/api';


export const SettingsPage: React.FC = () => {
    const { user, logout, refreshUser } = useAuth();
    const navigate = useNavigate();

    // Theme state
    const [isDarkMode, setIsDarkMode] = useState(() => {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    });

    // Global Defaults State
    const [gpaTableJson, setGpaTableJson] = useState('{}');
    const [nickname, setNickname] = useState('');

    // Dirty checking
    const [initialState, setInitialState] = useState<{ nickname: string, gpaTableJson: string } | null>(null);
    const [isDirty, setIsDirty] = useState(false);

    const [googleLinkError, setGoogleLinkError] = useState('');
    const [googleLinkSuccess, setGoogleLinkSuccess] = useState(false);
    const [isGoogleLinking, setIsGoogleLinking] = useState(false);
    const [isGoogleLinkReady, setIsGoogleLinkReady] = useState(false);
    const googleLinkRef = useRef<HTMLDivElement>(null);
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

    useEffect(() => {
        if (user) {
            const initialGpa = (user as any).gpa_scaling_table || '{"90-100": 4.0, "85-89": 4.0, "80-84": 3.7, "77-79": 3.3, "73-76": 3.0, "70-72": 2.7, "67-69": 2.3, "63-66": 2.0, "60-62": 1.7, "57-59": 1.3, "53-56": 1.0, "50-52": 0.7, "0-49": 0}';
            const initialNick = user.nickname || '';

            setGpaTableJson(initialGpa);
            setNickname(initialNick);
            setInitialState({ nickname: initialNick, gpaTableJson: initialGpa });
        }
    }, [user]);

    useEffect(() => {
        if (initialState) {
            const hasChanged = nickname !== initialState.nickname || gpaTableJson !== initialState.gpaTableJson;
            setIsDirty(hasChanged);
        }
    }, [nickname, gpaTableJson, initialState]);

    useEffect(() => {
        setGoogleLinkError('');
        setGoogleLinkSuccess(false);
    }, [user?.google_sub]);

    useEffect(() => {
        if (!googleClientId || !user || user.google_sub) {
            return;
        }

        let cancelled = false;
        let initialized = false;

        const tryInitGoogle = () => {
            if (initialized || cancelled || !googleLinkRef.current) {
                return initialized;
            }

            const google = (window as any).google;
            if (!google?.accounts?.id) {
                return false;
            }

            google.accounts.id.initialize({
                client_id: googleClientId,
                callback: async (response: { credential: string }) => {
                    if (!response?.credential) {
                        setGoogleLinkError('Google link failed. Please try again.');
                        return;
                    }
                    setGoogleLinkError('');
                    setIsGoogleLinking(true);
                    try {
                        await axios.post('/api/auth/google/link', {
                            id_token: response.credential
                        });
                        await refreshUser();
                        setGoogleLinkSuccess(true);
                    } catch (err: any) {
                        setGoogleLinkError(err.response?.data?.detail || 'Google link failed.');
                    } finally {
                        setIsGoogleLinking(false);
                    }
                }
            });

            google.accounts.id.renderButton(googleLinkRef.current, {
                theme: 'outline',
                size: 'large',
                text: 'continue_with',
                shape: 'pill',
                width: '220'
            });

            initialized = true;
            setIsGoogleLinkReady(true);
            return true;
        };

        if (!tryInitGoogle()) {
            const intervalId = window.setInterval(() => {
                if (tryInitGoogle()) {
                    window.clearInterval(intervalId);
                }
            }, 200);
            return () => {
                cancelled = true;
                window.clearInterval(intervalId);
            };
        }

        return () => {
            cancelled = true;
        };
    }, [googleClientId, refreshUser, user]);

    // Warn on browser refresh/close
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    // Auto-save & Animation 
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success'>('idle');
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-save Effect
    useEffect(() => {
        if (!initialState) return;

        // Check if actually changed
        const hasChanged = nickname !== initialState.nickname || gpaTableJson !== initialState.gpaTableJson;

        if (hasChanged) {
            // Clear existing timer
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }

            // Set new timer
            autoSaveTimerRef.current = setTimeout(() => {
                saveSettings();
            }, 1000); // 1s debounce
        }

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [nickname, gpaTableJson, initialState]);

    const saveSettings = async () => {
        try {
            JSON.parse(gpaTableJson);
        } catch {
            // Don't auto-save invalid JSON, maybe show error? 
            // For now just return to avoid annoyance
            return;
        }

        setSaveState('saving');
        try {
            await api.updateUser({
                gpa_scaling_table: gpaTableJson,
                nickname: nickname
            });
            await refreshUser();

            setInitialState({ nickname, gpaTableJson });
            setIsDirty(false);

            setSaveState('success');

            // Revert to idle after delay
            setTimeout(() => {
                setSaveState('idle');
            }, 2000);

        } catch (error) {
            console.error("Failed to save settings", error);
            setSaveState('idle'); // Or error state if needed
            alert('Failed to save settings');
        }
    };

    // Manual Back Handler
    const handleBack = (e: React.MouseEvent) => {
        // If saving, wait? Or allow exit? Allow exit for now.
        // If dirty but not saved (network error?), confirm.
        if (isDirty && saveState === 'idle') {
            e.preventDefault();
            if (window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
                navigate(-1);
            }
        } else {
            navigate(-1);
        }
    };

    // Mock user settings (unused for now)
    // const [email, setEmail] = useState(user?.email || '');

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleTheme = () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
        localStorage.setItem('theme', newMode ? 'dark' : 'light');
    };

    return (
        <Layout>
            <Container padding="2rem">
                <BackButton label="Back to Home" onClick={handleBack} />
                <h1 style={{ marginBottom: '2rem', userSelect: 'none' }}>Settings</h1>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <SettingsSection
                    title="Appearance"
                    description="Switch between light and dark mode."
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', userSelect: 'none' }}>Theme</h3>
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', userSelect: 'none' }}>
                                Choose your preferred interface style
                            </p>
                        </div>
                        <Button variant="secondary" onClick={toggleTheme}>
                            {isDarkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
                        </Button>
                    </div>
                </SettingsSection>

                <SettingsSection
                    title="Account"
                    description="Manage your profile and sign-in settings."
                >
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            marginBottom: '1rem'
                        }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '50%',
                                background: 'var(--color-primary)',
                                color: 'var(--color-accent-text)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '24px',
                                fontWeight: 'bold'
                            }}>
                                {user?.email?.charAt(0).toUpperCase() || 'U'}
                            </div>

                            <div>
                                <h3 style={{ fontSize: '1.2rem', userSelect: 'none' }}>{user?.nickname || user?.email}</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0, userSelect: 'none' }}>{user?.email}</p>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, userSelect: 'none' }}>
                                Nickname
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    placeholder="Enter a nickname"
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                        background: 'var(--color-bg-secondary)',
                                        color: 'var(--color-text-primary)'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            flexWrap: 'wrap',
                            marginBottom: '1rem'
                        }}>
                            <div>
                                <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem', userSelect: 'none' }}>Google</h3>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', margin: 0, userSelect: 'none' }}>
                                    {user?.google_sub ? 'Connected to your account' : 'Connect Google for one-click sign in'}
                                </p>
                            </div>
                            {googleClientId ? (
                                user?.google_sub ? (
                                    <span style={{
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '999px',
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        color: 'rgb(16, 185, 129)',
                                        fontSize: '0.85rem',
                                        fontWeight: 600
                                    }}>
                                        Connected
                                    </span>
                                ) : (
                                    <div style={{ minWidth: '220px', opacity: isGoogleLinking ? 0.6 : 1 }}>
                                        <div ref={googleLinkRef} />
                                        {!isGoogleLinkReady && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '0.5rem' }}>
                                                Loading Google sign-in...
                                            </div>
                                        )}
                                    </div>
                                )
                            ) : (
                                <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>
                                    Not configured
                                </span>
                            )}
                        </div>

                        {googleLinkError && (
                            <div style={{
                                color: 'var(--color-danger)',
                                fontSize: '0.875rem',
                                marginBottom: '1rem',
                                padding: '0.75rem',
                                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                                borderRadius: '0.75rem',
                                border: '1px solid rgba(239, 68, 68, 0.1)'
                            }}>
                                {googleLinkError}
                            </div>
                        )}

                        {googleLinkSuccess && (
                            <div style={{
                                color: 'rgb(16, 185, 129)',
                                fontSize: '0.875rem',
                                marginBottom: '1rem',
                                padding: '0.75rem',
                                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                                borderRadius: '0.75rem',
                                border: '1px solid rgba(16, 185, 129, 0.2)'
                            }}>
                                Google account connected.
                            </div>
                        )}
                    </div>

                    <Button variant="secondary" onClick={handleLogout} style={{ color: 'var(--color-error, #ef4444)', borderColor: 'var(--color-error, #ef4444)' }}>
                        Sign Out
                    </Button>
                </SettingsSection>

                <SettingsSection
                    title="Global Defaults"
                    description="Set defaults for new programs when no custom table is defined."
                >
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, userSelect: 'none' }}>
                            Default GPA Scaling Table
                        </label>
                        <GPAScalingTable
                            value={gpaTableJson}
                            onChange={(newValue) => {
                                setGpaTableJson(newValue);
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
                            <Button
                                onClick={() => saveSettings()}
                                disabled={saveState === 'saving'}
                                style={{ minWidth: '140px' }}
                            >
                                <div className="save-btn-content">
                                    {(saveState === 'idle' || saveState === 'saving') && (
                                        <span className={`save-btn-text ${saveState === 'saving' ? 'exit-up' : 'enter-up'}`}>
                                            Save Settings
                                        </span>
                                    )}

                                    {saveState === 'saving' && (
                                        <div className="save-spinner"></div>
                                    )}

                                    {saveState === 'success' && (
                                        <div className="fade-enter" style={{ gridArea: '1 / 1', display: 'grid', placeItems: 'center' }}>
                                            <svg className="save-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20 6L9 17l-5-5" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                        </Button>
                    </div>
                </SettingsSection>
                </div>
            </Container>
        </Layout>
    );
};
