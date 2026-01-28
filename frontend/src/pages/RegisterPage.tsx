import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { motion } from 'framer-motion';

import { useHeroGradient } from '../hooks/useHeroGradient';
import { getPasswordRuleError, passwordRuleHint } from '../utils/passwordRules';

export const RegisterPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [googleError, setGoogleError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isGoogleReady, setIsGoogleReady] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const googleButtonRef = useRef<HTMLDivElement>(null);
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

    // Physics-based lighting
    const heroStyle = useHeroGradient();

    useEffect(() => {
        if (!googleClientId) {
            return;
        }

        let cancelled = false;
        let initialized = false;

        const tryInitGoogle = () => {
            if (initialized || cancelled || !googleButtonRef.current) {
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

            google.accounts.id.renderButton(googleButtonRef.current, {
                theme: 'outline',
                size: 'large',
                text: 'continue_with',
                shape: 'pill',
                width: '100%'
            });

            initialized = true;
            setIsGoogleReady(true);
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
    }, [googleClientId, login, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const passwordError = getPasswordRuleError(password);
        if (passwordError) {
            setError(passwordError);
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);

        try {
            // Register
            await axios.post('/api/auth/register', {
                email,
                password
            });

            // After register, login to get token
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const loginResponse = await axios.post('/api/auth/token', formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            login(loginResponse.data.access_token);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to register. Please try again.');
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
            ...heroStyle,
            padding: '1rem'
        }}>
            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                style={{
                    width: '100%',
                    maxWidth: '380px',
                    padding: '3rem 2.5rem',
                    backgroundColor: 'var(--color-bg-glass)', // Fallback
                    background: 'color-mix(in srgb, var(--color-bg-primary), transparent 15%)', // High opacity glass
                    backdropFilter: 'blur(40px)',
                    WebkitBackdropFilter: 'blur(40px)',
                    borderRadius: 'var(--radius-xl)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                }}
            >
                <div style={{ 
                    marginBottom: '2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start'
                }}>
                    {/* Logo Area */}
                    <div style={{
                        marginBottom: '1.5rem',
                        fontWeight: 700,
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: 'var(--color-text-primary)',
                        userSelect: 'none',
                        WebkitUserSelect: 'none'
                    }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-accent-primary)' }}></div>
                        Semestra
                    </div>

                    <h1 style={{
                        fontSize: '3rem',
                        lineHeight: 1,
                        letterSpacing: '-0.04em',
                        background: 'linear-gradient(to right, var(--color-text-primary), var(--color-text-secondary))',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: '0.5rem',
                        userSelect: 'none',
                        WebkitUserSelect: 'none'
                    }}>
                        Sign Up
                    </h1>
                    <h2 style={{
                        fontSize: '1.25rem',
                        color: 'var(--color-text-tertiary)',
                        marginBottom: '0.5rem',
                        fontWeight: 500,
                        userSelect: 'none',
                        WebkitUserSelect: 'none'
                    }}>
                        Get Started
                    </h2>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    {googleClientId ? (
                        <>
                            <div ref={googleButtonRef} style={{ width: '100%' }} />
                            {!isGoogleReady && (
                                <div style={{
                                    marginTop: '0.5rem',
                                    fontSize: '0.8rem',
                                    color: 'var(--color-text-tertiary)'
                                }}>
                                    Loading Google sign-in...
                                </div>
                            )}
                        </>
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
                    marginBottom: '1.5rem',
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
                            placeholder="hello@example.com"
                            required
                            style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                borderColor: 'var(--color-border)',
                                borderRadius: '0.75rem',
                                boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)'
                            }}
                            wrapperStyle={{ marginBottom: 0 }}
                        />
                        <Input
                            label="Password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                borderColor: 'var(--color-border)',
                                borderRadius: '0.75rem',
                                boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)'
                            }}
                            wrapperStyle={{ marginBottom: 0 }}
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
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    )}
                                </button>
                            }
                        />
                        <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-text-tertiary)',
                            marginTop: '-0.25rem'
                        }}>
                            {passwordRuleHint}
                        </div>
                        <Input
                            label="Confirm Password"
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                borderColor: 'var(--color-border)',
                                borderRadius: '0.75rem',
                                boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)'
                            }}
                            rightElement={
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                                    {showConfirmPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    )}
                                </button>
                            }
                        />
                    </div>

                    {error && (
                        <div style={{
                            color: 'var(--color-danger)',
                            fontSize: '0.875rem',
                            marginTop: '1rem',
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
                            marginTop: '1rem',
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
                            marginTop: '1.5rem',
                            borderRadius: '0.75rem',
                            height: '3rem',
                            fontSize: '1rem',
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                        }}
                    >
                        {isLoading ? 'Creating account...' : 'Register'}
                    </Button>
                </form>

                <div style={{
                    marginTop: '2rem',
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: '1.5rem',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    userSelect: 'none',
                    WebkitUserSelect: 'none'
                }}>
                    <span style={{ opacity: 0.8 }}>Already have an account?</span>{' '}
                    <Link
                        to="/login"
                        style={{
                            color: 'var(--color-text-primary)',
                            fontWeight: 600,
                            textDecoration: 'none',
                            borderBottom: '1px solid var(--color-text-primary)',
                            paddingBottom: '1px'
                        }}
                    >
                        Sign In
                    </Link>
                </div>
            </motion.div>
        </div>
    );
};
