import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Checkbox } from '../components/Checkbox';
import { motion } from 'framer-motion';

import { useHeroGradient } from '../hooks/useHeroGradient';
import { getPasswordRuleError, passwordRuleHint } from '../utils/passwordRules';

export const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    // Physics-based lighting
    const heroStyle = useHeroGradient();

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
                    background: 'color-mix(in srgb, var(--color-bg-primary), transparent 15%)', // More opaque (85%)
                    backdropFilter: 'blur(40px)', // Stronger blur
                    WebkitBackdropFilter: 'blur(40px)',
                    borderRadius: 'var(--radius-xl)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                }}
            >
                <div style={{
                    marginBottom: '2.5rem',
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
                        Welcome
                    </h1>
                    <h2 style={{
                        fontSize: '1.25rem',
                        color: 'var(--color-text-tertiary)',
                        marginBottom: '0.5rem',
                        fontWeight: 500,
                        userSelect: 'none',
                        WebkitUserSelect: 'none'
                    }}>
                        Back to your workspace
                    </h2>
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
                    </div>

                    <div style={{ marginBottom: '1.5rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

                    <Button
                        type="submit"
                        fullWidth
                        disabled={isLoading}
                        style={{
                            borderRadius: '0.75rem', // Matching input radius for consistency, or use pill
                            height: '3rem',
                            fontSize: '1rem',
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                        }}
                    >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </Button>
                </form>

                <div style={{
                    marginTop: '2rem',
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: '1.5rem',
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
        </div>
    );
};
