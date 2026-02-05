import React, { useEffect, useId, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import { motion } from 'framer-motion';

import GradientBlinds from '../components/GradientBlinds';
import { getPasswordRuleError, passwordRuleHint } from '../utils/passwordRules';
import { loadGoogleIdentityScriptWhenIdle } from '../utils/googleIdentity';

export const RegisterPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
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
    const emailId = useId();
    const passwordId = useId();
    const confirmPasswordId = useId();

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
        ? ['#005050', '#2D2900'] // Dark teal/olive that inverts to pink/purple
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
        <div className="min-h-screen flex items-center justify-center p-4 relative bg-background overflow-hidden">
            <div className="absolute inset-0 z-0">
                <GradientBlinds
                    gradientColors={gradientColors}
                    filter={currentTheme === 'light' ? 'invert(1) contrast(0.8)' : undefined}
                    blindMinWidth={80}
                />
            </div>

            {/* Background Logo */}
            <div className="absolute top-8 left-8 font-bold text-xl flex items-center gap-2 text-foreground z-10 select-none drop-shadow-md">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                Semestra
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                onAnimationComplete={() => setIsGlassReady(true)}
                className="relative z-10 w-full max-w-[360px]"
            >
                <Card 
                    className={`border-none shadow-2xl transition-all duration-300 rounded-xl overflow-hidden ${isGlassReady
                        ? 'bg-background/60 backdrop-blur-3xl support-[backdrop-filter]:bg-background/40'
                        : 'bg-background'
                        }`}
                >
                    <CardHeader className="pb-6">
                        <CardTitle className="text-4xl tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent pb-1">
                            Sign Up
                        </CardTitle>
                        <CardDescription className="text-base font-medium">
                            Get Started
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="min-h-[3rem] relative flex items-center justify-center">
                            {googleClientId ? (
                                <>
                                    <div ref={googleButtonRef} className="w-full" />
                                    {!isGoogleReady && (
                                        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                                            Loading Google sign-in...
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-sm text-muted-foreground text-center">
                                    Google sign-in is not configured.
                                </div>
                            )}
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">
                                    or
                                </span>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor={emailId}>Email</Label>
                                <Input
                                    id={emailId}
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="h-11 shadow-inner bg-secondary/50 border-transparent focus:bg-background focus:border-input transition-colors"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={passwordId}>Password</Label>
                                <TooltipProvider>
                                    <Tooltip open={isPasswordFocused}>
                                        <TooltipTrigger asChild>
                                            <div className="relative">
                                                <Input
                                                    id={passwordId}
                                                    type={showPassword ? "text" : "password"}
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    onFocus={() => setIsPasswordFocused(true)}
                                                    onBlur={() => setIsPasswordFocused(false)}
                                                    required
                                                    className="h-11 pr-10 shadow-inner bg-secondary/50 border-transparent focus:bg-background focus:border-input transition-colors"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-0 top-0 h-11 w-11 text-muted-foreground hover:text-foreground"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8-11-8-11-8-11-8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                    )}
                                                </Button>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" align="start" className="max-w-[300px] text-xs">
                                            {passwordRuleHint}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={confirmPasswordId}>Confirm Password</Label>
                                <div className="relative">
                                    <Input
                                        id={confirmPasswordId}
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        className="h-11 pr-10 shadow-inner bg-secondary/50 border-transparent focus:bg-background focus:border-input transition-colors"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-11 w-11 text-muted-foreground hover:text-foreground"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        {showConfirmPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                        ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8-11-8-11-8-11-8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {error && (
                                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                                    {error}
                                </div>
                            )}

                            {googleError && (
                                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                                    {googleError}
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full h-11 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
                                disabled={isLoading || isGoogleLoading}
                            >
                                {isLoading ? 'Creating account...' : 'Register'}
                            </Button>
                        </form>

                        <div className="pt-4 mt-2 border-t text-sm text-muted-foreground flex items-center gap-1">
                            Already have an account?
                            <Link
                                to="/login"
                                className="font-semibold text-foreground hover:underline underline-offset-4 decoration-2"
                            >
                                Sign In
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-muted-foreground select-none z-10">
                © {currentYear} Semestra. All rights reserved.
            </div>
        </div>
    );
};
