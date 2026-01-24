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
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (user && (user as any).gpa_scaling_table) {
            setGpaTableJson((user as any).gpa_scaling_table);
        } else {
            setGpaTableJson('{"90-100": 4.0, "85-89": 4.0, "80-84": 3.7, "77-79": 3.3, "73-76": 3.0, "70-72": 2.7, "67-69": 2.3, "63-66": 2.0, "60-62": 1.7, "57-59": 1.3, "53-56": 1.0, "50-52": 0.7, "0-49": 0}');
        }
    }, [user]);

    const handleSaveDefaults = async () => {
        // Validation is now handled by the component logic for input, 
        // but we can parse here to be safe before sending.
        try {
            JSON.parse(gpaTableJson);
        } catch (e) {
            alert('Invalid GPA Table data');
            return;
        }

        setIsSaving(true);
        try {
            await api.updateUser({ gpa_scaling_table: gpaTableJson });
            await refreshUser();
            alert('Settings saved successfully');
        } catch (error) {
            console.error("Failed to save settings", error);
            alert('Failed to save settings');
        } finally {
            setIsSaving(false);
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
                        Set default GPA scaling tables for new Programs. These settings will be applied when no specific table is defined for a program, semester, or course.
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

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button onClick={handleSaveDefaults} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Defaults'}
                        </Button>
                    </div>
                </section>
            </div>
        </Layout>
    );
};
