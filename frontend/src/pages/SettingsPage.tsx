import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';

import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';

export const SettingsPage: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Theme state could be in a ThemeContext, but for now we might just toggle on documentElement
    const [isDarkMode, setIsDarkMode] = useState(() => {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    });

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
                <BackButton to="/" label="Back to Home" />
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
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '24px',
                                fontWeight: 'bold'
                            }}>
                                {user?.email?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem' }}>{user?.email}</h3>
                                <span style={{
                                    padding: '0.25rem 0.5rem',
                                    background: 'var(--color-bg-secondary)',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    color: 'var(--color-text-secondary)'
                                }}>Basic Plan</span>
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
                        Set default GPA scaling tables for new Programs (Coming Soon).
                    </p>
                </section>
            </div>
        </Layout>
    );
};
