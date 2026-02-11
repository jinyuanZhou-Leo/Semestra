import React, { useEffect, useId, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';

import GradientBlinds from '../components/GradientBlinds';
import { useTheme } from '../components/ThemeProvider';
import { getPasswordRuleError } from '../utils/passwordRules';
import { loadGoogleIdentityScriptWhenIdle } from '../utils/googleIdentity';

export const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    // const [googleError, setGoogleError] = useState(''); // Removed in favor of toast
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
    const rememberMeId = useId();
    const { theme } = useTheme();
    const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
        window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    );
    const currentTheme: 'light' | 'dark' = theme === 'system' ? systemTheme : theme;

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
        handleChange();
        mediaQuery.addEventListener('change', handleChange);

        return () => {
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
            } catch {
                if (!cancelled) {
                    toast.error('Google sign-in is unavailable right now. Please try again later.');
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
                        toast.error('Google sign-in failed. Please try again.');
                        return;
                    }
                    // setGoogleError(''); // Removed
                    setIsGoogleLoading(true);
                    try {
                        const loginResponse = await axios.post('/api/auth/google', {
                            id_token: response.credential
                        });
                        login(loginResponse.data.access_token);
                        navigate('/');
                    } catch (err: any) {
                        toast.error(err.response?.data?.detail || 'Google sign-in failed.');
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
            const lowerEmail = email.toLowerCase();
            formData.append('username', lowerEmail); // backend expects username for email
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
            toast.error(err.response?.data?.detail || 'Failed to login. Please check your credentials.');
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
            <div className={`absolute top-8 left-8 font-bold text-xl flex items-center gap-2 z-10 select-none drop-shadow-md ${currentTheme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${currentTheme === 'light' ? 'bg-slate-900' : 'bg-white'}`} />
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
                        ? (currentTheme === 'light' ? 'bg-white/80 backdrop-blur-3xl' : 'bg-zinc-900/65 backdrop-blur-3xl')
                            : (currentTheme === 'light' ? 'bg-white' : 'bg-zinc-900')
                        } ${currentTheme === 'light' ? 'text-slate-900' : 'text-zinc-100'}`}
                >
                    <CardHeader className="pb-6">
                        <CardTitle className={`text-4xl tracking-tight pb-1 ${currentTheme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                            Welcome
                        </CardTitle>
                        <CardDescription className={`text-base font-medium ${currentTheme === 'light' ? 'text-slate-600' : 'text-zinc-300'}`}>
                            Back to your workspace
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="h-10 relative flex items-center justify-center">
                            {googleClientId ? (
                                <>
                                    <div ref={googleButtonRef} className="w-full h-10" />
                                    {!isGoogleReady && (
                                        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none">
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

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor={emailId}>Email</Label>
                                <Input
                                    id={emailId}
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="h-11 bg-secondary/50 border-muted-foreground/20 hover:bg-secondary/70 transition-colors focus-visible:ring-offset-0"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor={passwordId}>Password</Label>
                                <div className="relative">
                                    <Input
                                        id={passwordId}
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="h-11 pr-10 bg-secondary/50 border-muted-foreground/20 hover:bg-secondary/70 transition-colors focus-visible:ring-offset-0"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-11 w-11 text-muted-foreground hover:text-foreground"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                                <Eye className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id={rememberMeId}
                                        checked={rememberMe}
                                        onCheckedChange={(checked) => {
                                            if (checked === "indeterminate") return;
                                            setRememberMe(checked);
                                        }}
                                        className="bg-secondary/50 border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                    />
                                    <Label htmlFor={rememberMeId} className="text-sm text-muted-foreground font-normal cursor-pointer">
                                        Remember me
                                    </Label>
                                </div>
                            </div>

                            {error && (
                                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                                    {error}
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full h-11 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
                                disabled={isLoading || isGoogleLoading}
                            >
                                {isLoading ? 'Signing in...' : 'Sign In'}
                            </Button>

                            <Button asChild variant="outline" className="w-full h-11 text-base font-semibold">
                                <Link to="/register">
                                    Sign Up
                                </Link>
                            </Button>
                        </form>

                    </CardContent>
                </Card>
            </motion.div>

            <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-muted-foreground select-none z-10">
                © {currentYear} Semestra. All rights reserved.
            </div>
        </div>
    );
};
