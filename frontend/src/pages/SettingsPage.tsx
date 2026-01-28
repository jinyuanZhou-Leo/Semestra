import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { GPAScalingTable } from '../components/GPAScalingTable';

import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import api from '../services/api';
import { useEffect } from 'react';


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
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Dirty checking
    const [initialState, setInitialState] = useState<{ nickname: string, gpaTableJson: string } | null>(null);
    const [isDirty, setIsDirty] = useState(false);

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

    const handleSaveDefaults = async () => {
        try {
            JSON.parse(gpaTableJson);
        } catch (e) {
            alert('Invalid GPA Table data');
            return;
        }

        setIsSaving(true);
        try {
            await api.updateUser({
                gpa_scaling_table: gpaTableJson,
                nickname: nickname
            });
            await refreshUser();

            // Update initial state to new saved state
            setInitialState({ nickname, gpaTableJson });
            setIsDirty(false); // Clear dirty flag immediately

            // Show static success message
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error("Failed to save settings", error);
            alert('Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    // Manual Back Handler
    const handleBack = (e: React.MouseEvent) => {
        if (isDirty) {
            e.preventDefault();
            if (window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
                navigate(-1);
            }
        } else {
            // Default behavior handles standard navigation if I used a link, but for BackButton component
            // If I just pass a custom onClick, I can manually navigate.
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
            <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
                <BackButton label="Back to Home" onClick={handleBack} />
                <h1 style={{ marginBottom: '2rem' }}>Settings</h1>

                <section style={{ marginBottom: '3rem' }}>
                    <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                        Appearance
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>Theme</h3>
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                                Switch between light and dark mode
                            </p>
                        </div>
                        <Button variant="secondary" onClick={toggleTheme}>
                            {isDarkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
                        </Button>
                    </div>
                </section>

                <section style={{ marginBottom: '3rem' }}>
                    <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                        Account
                    </h2>
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
                                <h3 style={{ fontSize: '1.2rem' }}>{user?.nickname || user?.email}</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>{user?.email}</p>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
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
                    </div>

                    <Button variant="secondary" onClick={handleLogout} style={{ color: 'var(--color-error, #ef4444)', borderColor: 'var(--color-error, #ef4444)' }}>
                        Sign Out
                    </Button>
                </section>

                <section>
                    <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                        Global Defaults
                    </h2>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                        Set default GPA scaling tables for new Programs. These settings will be applied when no program-specific table is defined.
                    </p>

                    <div style={{ marginBottom: '1rem' }}>

                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
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
                        {showSuccess && (
                            <span style={{
                                color: 'var(--color-success, #22c55e)',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                animation: 'fadeIn 0.3s ease-in-out'
                            }}>
                                <style>
                                    {`
                                        @keyframes fadeIn {
                                            from { opacity: 0; transform: translateX(10px); }
                                            to { opacity: 1; transform: translateX(0); }
                                        }
                                    `}
                                </style>
                                Saved successfully
                            </span>
                        )}
                        <Button
                            onClick={handleSaveDefaults}
                            disabled={isSaving}
                            style={{ minWidth: '140px' }} // Fix width to prevent jump
                        >
                            {isSaving ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </div>
                </section>
            </div>
        </Layout>
    );
};
