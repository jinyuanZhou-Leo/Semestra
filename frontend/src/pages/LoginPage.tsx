import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Checkbox } from '../components/Checkbox';
import { motion } from 'framer-motion';

import GradientBlinds from '../components/GradientBlinds';
import { getPasswordRuleError } from '../utils/passwordRules';
import { loadGoogleIdentityScriptWhenIdle } from '../utils/googleIdentity';

export const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [googleError, setGoogleError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isGoogleReady, setIsGoogleReady] = useState(false);
    const [isGlassReady, setIsGlassReady] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const googleButtonRef = useRef<HTMLDivElement>(null);
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    const currentYear = new Date().getFullYear();

    // Theme detection
    const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
        const themePreference = localStorage.getItem('themePreference');
        if (themePreference === 'system' || !themePreference) {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return themePreference === 'dark' ? 'dark' : 'light';
    });

    // Listen to theme changes
    useEffect(() => {
        const applyTheme = () => {
            const themePreference = localStorage.getItem('themePreference');
            if (themePreference === 'system' || !themePreference) {
                const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                setCurrentTheme(systemTheme);
            } else {
                setCurrentTheme(themePreference === 'dark' ? 'dark' : 'light');
            }
        };

        applyTheme();

        // Listen to storage changes (when user changes theme in another tab)
        window.addEventListener('storage', applyTheme);
        // Listen to system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => applyTheme();
        mediaQuery.addEventListener('change', handleChange);

        return () => {
            window.removeEventListener('storage', applyTheme);
            mediaQuery.removeEventListener('change', handleChange);
        };
    }, []);

    // Define gradient colors based on theme
    // For light mode: use dark colors that invert to light purple
    const gradientColors = currentTheme === 'light'
        ? ['#206d6dff', '#6d650dff'] // Dark teal/olive that inverts to pink/purple
        : ['#FF9FFC', '#5227FF']; // Original vibrant colors for dark mode

    useEffect(() => {
        if (!googleClientId || !isGlassReady) {
            return;
        }

        let cancelled = false;

        const initGoogle = async () => {
            try {
                await loadGoogleIdentityScriptWhenIdle();
            } catch (err) {
                if (!cancelled) {
                    setGoogleError('Google sign-in is unavailable right now. Please try again later.');
                }
                return;
            }

            if (cancelled || !googleButtonRef.current) {
                return;
            }

            const google = (window as any).google;
            if (!google?.accounts?.id) {
                return;
            }

            google.accounts.id.initialize({
                client_id: googleClientId,
                callback: async (response: { credential: string }) => {
                    if (!response?.credential) {
                        setGoogleError('Google sign-in failed. Please try again.');
                        return;
                    }
                    setGoogleError('');
                    setIsGoogleLoading(true);
                    try {
                        const loginResponse = await axios.post('/api/auth/google', {
                            id_token: response.credential
                        });
                        login(loginResponse.data.access_token);
                        navigate('/');
                    } catch (err: any) {
                        setGoogleError(err.response?.data?.detail || 'Google sign-in failed.');
                    } finally {
                        setIsGoogleLoading(false);
                    }
                }
            });

            requestAnimationFrame(() => {
                if (cancelled || !googleButtonRef.current) {
                    return;
                }
                const buttonWidth = Math.floor(googleButtonRef.current.getBoundingClientRect().width);
                google.accounts.id.renderButton(googleButtonRef.current, {
                    theme: 'outline',
                    size: 'large',
                    text: 'continue_with',
                    shape: 'pill',
                    ...(buttonWidth ? { width: buttonWidth } : {})
                });
                setIsGoogleReady(true);
            });
        };

        initGoogle();

        return () => {
            cancelled = true;
        };
    }, [googleClientId, login, navigate, isGlassReady]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const passwordError = getPasswordRuleError(password);
        if (passwordError) {
            setError(passwordError);
            return;
        }

        setIsLoading(true);

        try {
            const formData = new URLSearchParams();
            formData.append('username', email); // backend expects username for email
            formData.append('password', password);
            if (rememberMe) {
                formData.append('remember_me', 'true');
            }

            const response = await axios.post('/api/auth/token', formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            login(response.data.access_token);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to login. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            position: 'relative',
            background: 'var(--color-bg-primary)',
            overflow: 'hidden'
        }}>
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 0
            }}>
                <GradientBlinds
                    gradientColors={gradientColors}
                    filter={currentTheme === 'light' ? 'invert(1) contrast(0.8)' : undefined}
                    blindMinWidth={80}
                />
            </div>

            {/* Background Logo */}
            <div style={{
                position: 'absolute',
                top: '2rem',
                left: '2rem',
                fontWeight: 700,
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--color-text-primary)',
                textShadow: '0 2px 4px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.2)',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                zIndex: 1 // Sits above background
            }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-accent-primary)' }}></div>
                Semestra
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                onAnimationComplete={() => setIsGlassReady(true)}
                style={{
                    position: 'relative', // Ensure z-index works
                    zIndex: 1, // Above the logo
                    width: '100%',
                    maxWidth: '360px', // Slightly narrower
                    padding: '2rem 2rem', // More compact padding
                    backgroundColor: isGlassReady ? 'var(--color-bg-glass)' : 'var(--color-bg-primary)',
                    background: isGlassReady
                        ? 'color-mix(in srgb, var(--color-bg-primary), transparent 15%)'
                        : 'var(--color-bg-primary)',
                    backdropFilter: isGlassReady ? 'blur(40px)' : undefined,
                    WebkitBackdropFilter: isGlassReady ? 'blur(40px)' : undefined,
                    transition: 'background-color 240ms ease, background 240ms ease, backdrop-filter 240ms ease, -webkit-backdrop-filter 240ms ease',
                    borderRadius: 'var(--radius-xl)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.2)',
                }}
            >
                <div style={{
                    marginBottom: '1.5rem', // Reduced margin
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start'
                }}>
                    <h1 style={{
                        fontSize: '2.5rem', // Slightly smaller
                        lineHeight: 1.2, // Increased line height to prevent clipping
                        paddingBottom: '0.1em', // Extra safety for descenders
                        letterSpacing: '-0.04em',
                        background: 'linear-gradient(to right, var(--color-text-primary), var(--color-text-secondary))',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: '0.25rem', // Reduced margin
                        userSelect: 'none',
                        WebkitUserSelect: 'none'
                    }}>
                        Welcome
                    </h1>
                    <h2 style={{
                        fontSize: '1rem', // Slightly smaller
                        color: 'var(--color-text-tertiary)',
                        marginBottom: '0.5rem',
                        fontWeight: 500,
                        userSelect: 'none',
                        WebkitUserSelect: 'none'
                    }}>
                        Back to your workspace
                    </h2>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                    {googleClientId ? (
                        <div
                            style={{
                                minHeight: '3rem',
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <div ref={googleButtonRef} style={{ width: '100%' }} />
                            {!isGoogleReady && (
                                <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    textAlign: 'center',
                                    fontSize: '0.8rem',
                                    color: 'var(--color-text-tertiary)'
                                }}>
                                    Loading Google sign-in...
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--color-text-tertiary)'
                        }}>
                            Google sign-in is not configured.
                        </div>
                    )}
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '1.25rem',
                    color: 'var(--color-text-tertiary)',
                    fontSize: '0.8rem'
                }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                    <span>or</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <Input
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                borderColor: 'var(--color-border)',
                                borderRadius: '0.75rem',
                                boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
                                fontSize: '0.925rem' // Slightly compact font
                            }}
                            wrapperStyle={{ marginBottom: 0 }}
                        />
                        <Input
                            label="Password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                borderColor: 'var(--color-border)',
                                borderRadius: '0.75rem',
                                boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
                                fontSize: '0.925rem'
                            }}
                            rightElement={
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'inherit',
                                        opacity: 0.7
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                    onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    )}
                                </button>
                            }
                        />
                    </div>

                    <div style={{ marginBottom: '1.25rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Checkbox
                            id="remember_me"
                            checked={rememberMe}
                            onChange={(checked) => setRememberMe(checked)}
                            label="Remember me"
                        />
                    </div>

                    {error && (
                        <div style={{
                            color: 'var(--color-danger)',
                            fontSize: '0.875rem',
                            marginBottom: '1rem',
                            padding: '0.75rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.05)',
                            borderRadius: '0.75rem',
                            border: '1px solid rgba(239, 68, 68, 0.1)'
                        }}>
                            {error}
                        </div>
                    )}

                    {googleError && (
                        <div style={{
                            color: 'var(--color-danger)',
                            fontSize: '0.875rem',
                            marginBottom: '1rem',
                            padding: '0.75rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.05)',
                            borderRadius: '0.75rem',
                            border: '1px solid rgba(239, 68, 68, 0.1)'
                        }}>
                            {googleError}
                        </div>
                    )}

                    <Button
                        type="submit"
                        fullWidth
                        disabled={isLoading || isGoogleLoading}
                        style={{
                            borderRadius: '0.75rem', // Matching input radius for consistency, or use pill
                            height: '2.75rem', // Slightly smaller
                            fontSize: '0.925rem',
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                        }}
                    >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </Button>
                </form>

                <div style={{
                    marginTop: '1.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: '1.25rem',
                    textAlign: 'left', // Ensure left alignment
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    userSelect: 'none',
                    WebkitUserSelect: 'none'
                }}>
                    <span style={{ opacity: 0.8 }}>New here?</span>{' '}
                    <Link
                        to="/register"
                        style={{
                            color: 'var(--color-text-primary)',
                            fontWeight: 600,
                            textDecoration: 'none',
                            borderBottom: '1px solid var(--color-text-primary)',
                            paddingBottom: '1px'
                        }}
                    >
                        Sign Up
                    </Link>
                </div>
            </motion.div>
            <div
                style={{
                    position: 'absolute',
                    bottom: '1rem',
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    color: 'var(--color-text-tertiary)',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    zIndex: 1
                }}
            >
                © {currentYear} Semestra. All rights reserved.
            </div>
        </div>
    );
};
