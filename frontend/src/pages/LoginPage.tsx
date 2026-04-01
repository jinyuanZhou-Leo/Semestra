// input:  [cookie-session login actions, password/email-code auth endpoints, auth redirect restoration, optional prefilled auth-route state, theme hooks, shared auth OTP input, shared email-domain autocomplete input, Google identity button renderer, and shared auth-route shell presentation]
// output: [`LoginPage` route component]
// pos:    [Dedicated sign-in page that keeps password and email-code login intent explicit, handles verified existing-account continuation, and preserves post-login route restoration]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../contexts/AuthContext';
import { consumeAuthRedirectTarget } from '../utils/authRedirect';
import { renderGoogleIdentityButton } from '../utils/googleIdentity';
import { useTheme } from '../components/ThemeProvider';
import { AuthCodeInput } from '@/components/AuthCodeInput';
import { EmailDomainInput } from '@/components/EmailDomainInput';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type LoginLocationState = {
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
  email?: string;
  mode?: 'password' | 'email-code';
  verificationToken?: string;
  message?: string;
};

type EmailCodeVerifyResponse = {
  verification_token: string;
  next_step: 'login' | 'register' | 'reset_password';
};

type EmailCodeStep = 'email' | 'otp' | 'verified-login';

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const detail = (error as { response?: { data?: { detail?: { message?: string } | string } } })?.response?.data?.detail;
  if (typeof detail === 'string' && detail) {
    return detail;
  }
  if (detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string') {
    return detail.message;
  }
  return fallback;
};

export const LoginPage: React.FC = () => {
  const location = useLocation();
  const loginLocationState = (location.state as LoginLocationState | null) ?? null;
  const prefilledEmail = typeof loginLocationState?.email === 'string' ? loginLocationState.email : '';
  const prefilledVerificationToken = typeof loginLocationState?.verificationToken === 'string'
    ? loginLocationState.verificationToken
    : '';
  const prefilledMode = prefilledVerificationToken || loginLocationState?.mode === 'email-code' ? 'email-code' : 'password';
  const [mode, setMode] = useState<'password' | 'email-code'>(prefilledMode);
  const [emailCodeStep, setEmailCodeStep] = useState<EmailCodeStep>(prefilledVerificationToken ? 'verified-login' : 'email');
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [verificationToken, setVerificationToken] = useState(prefilledVerificationToken);
  const [rememberMe, setRememberMe] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [handoffMessage, setHandoffMessage] = useState(loginLocationState?.message ?? null as string | null);
  const [fieldErrors, setFieldErrors] = useState({
    email: null as string | null,
    password: null as string | null,
    code: null as string | null,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isCodeLoading, setIsCodeLoading] = useState(false);
  const [isVerifiedLoginLoading, setIsVerifiedLoginLoading] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [isGlassReady, setIsGlassReady] = useState(false);
  const { login } = useAuth();
  const { theme: themeMode } = useTheme();
  const navigate = useNavigate();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const emailId = useId();
  const passwordId = useId();
  const rememberMeId = useId();
  const emailRememberMeId = useId();
  const loginRedirectSource = loginLocationState?.from;
  const resolvePostLoginTarget = useCallback(
    () => consumeAuthRedirectTarget(loginRedirectSource, '/'),
    [loginRedirectSource],
  );
  useEffect(() => {
    document.documentElement.dataset.authPage = 'true';
    return () => {
      delete document.documentElement.dataset.authPage;
    };
  }, []);

  useEffect(() => {
    if (cooldownRemaining <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setCooldownRemaining((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownRemaining]);

  const googleButtonTheme = React.useMemo(() => {
    if (typeof window === 'undefined') {
      return 'outline';
    }
    const prefersDark = themeMode === 'dark'
      || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    return prefersDark ? 'filled_black' : 'outline';
  }, [themeMode]);

  useEffect(() => {
    if (mode !== 'email-code') {
      setFieldErrors((current) => ({
        ...current,
        password: null,
        code: null,
      }));
      return;
    }
    setFieldErrors((current) => ({
      ...current,
      password: null,
    }));
  }, [mode]);

  useEffect(() => {
    if (!googleClientId || !isGlassReady) {
      return;
    }

    let cancelled = false;

    const handleGoogleCredential = async (response: { credential?: string }) => {
      if (!response?.credential) {
        toast.error('Google sign-in failed. Please try again.');
        return;
      }
      try {
        await axios.post('/api/auth/google', { id_token: response.credential });
        await login();
        navigate(resolvePostLoginTarget(), { replace: true });
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'Google sign-in failed.'));
      }
    };

    const initGoogle = async () => {
      const buttonContainer = googleButtonRef.current;
      if (cancelled || !buttonContainer) {
        return;
      }
      try {
        const buttonWidth = Math.floor(buttonContainer.getBoundingClientRect().width);
        await renderGoogleIdentityButton(
          buttonContainer,
          googleClientId,
          handleGoogleCredential,
          {
            theme: googleButtonTheme,
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            ...(buttonWidth ? { width: buttonWidth } : {}),
          },
        );
      } catch {
        if (!cancelled) {
          toast.error('Google sign-in is unavailable right now. Please try again later.');
        }
        return;
      }

      requestAnimationFrame(() => {
        if (!cancelled && googleButtonRef.current) {
          setIsGoogleReady(true);
        }
      });
    };

    void initGoogle();

    return () => {
      cancelled = true;
      setIsGoogleReady(false);
    };
  }, [googleButtonTheme, googleClientId, isGlassReady, login, navigate, resolvePostLoginTarget]);

  const clearError = (key: keyof typeof fieldErrors) => {
    setFieldErrors((current) => ({ ...current, [key]: null }));
  };

  const resetEmailFlow = () => {
    setCode('');
    setVerificationToken('');
    setEmailCodeStep('email');
    setHandoffMessage(null);
    setFieldErrors((current) => ({
      ...current,
      code: null,
    }));
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors = {
      email: null as string | null,
      password: null as string | null,
      code: null as string | null,
    };

    if (!normalizedEmail) {
      nextErrors.email = 'Enter your email.';
    } else if (!isValidEmail(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!password) {
      nextErrors.password = 'Enter your password.';
    }

    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) {
      return;
    }

    setIsPasswordLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', normalizedEmail);
      formData.append('password', password);
      if (rememberMe) {
        formData.append('remember_me', 'true');
      }
      await axios.post('/api/auth/token', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      await login();
      navigate(resolvePostLoginTarget(), { replace: true });
    } catch {
      setFieldErrors((current) => ({
        ...current,
        password: 'Incorrect email or password.',
      }));
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleSendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setFieldErrors((current) => ({ ...current, email: 'Enter your email.' }));
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setFieldErrors((current) => ({ ...current, email: 'Enter a valid email address.' }));
      return;
    }

    setIsSendingCode(true);
    try {
      const response = await axios.post('/api/auth/email/send-code', {
        email: normalizedEmail,
        purpose: 'continue',
      });
      setEmail(normalizedEmail);
      setCode('');
      setVerificationToken('');
      setHandoffMessage(null);
      setCooldownRemaining(response.data.resend_in_seconds ?? 60);
      setEmailCodeStep('otp');
      setFieldErrors((current) => ({
        ...current,
        email: null,
        code: null,
      }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to send the verification code.'));
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleEmailCodeVerify = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setFieldErrors((current) => ({ ...current, email: 'Enter your email.' }));
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setFieldErrors((current) => ({ ...current, email: 'Enter a valid email address.' }));
      return;
    }
    if (code.trim().length !== 6) {
      setFieldErrors((current) => ({ ...current, code: 'Enter the 6-digit verification code.' }));
      return;
    }

    setIsCodeLoading(true);
    try {
      const verifyResponse = await axios.post<EmailCodeVerifyResponse>('/api/auth/email/verify-code', {
        email: normalizedEmail,
        purpose: 'continue',
        code,
      });
      if (verifyResponse.data.next_step === 'register') {
        navigate('/register', {
          replace: true,
          state: {
            email: normalizedEmail,
            verificationToken: verifyResponse.data.verification_token,
            message: 'No account exists for this email yet. Finish creating one.',
          },
        });
        return;
      }
      setVerificationToken(verifyResponse.data.verification_token);
      setEmailCodeStep('verified-login');
      setHandoffMessage('This email already has an account. Sign in to continue.');
      setFieldErrors((current) => ({
        ...current,
        code: null,
      }));
    } catch (error) {
      setFieldErrors((current) => ({
        ...current,
        code: getApiErrorMessage(error, 'Invalid or expired verification code.'),
      }));
    } finally {
      setIsCodeLoading(false);
    }
  };

  const handleVerifiedEmailLogin = async () => {
    if (!verificationToken) {
      toast.error('Your verified sign-in session expired. Start again with your email.');
      resetEmailFlow();
      return;
    }

    setIsVerifiedLoginLoading(true);
    try {
      await axios.post('/api/auth/login/email', {
        verification_token: verificationToken,
        remember_me: rememberMe,
      });
      await login();
      navigate(resolvePostLoginTarget(), { replace: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to sign in with this verified email.'));
    } finally {
      setIsVerifiedLoginLoading(false);
    }
  };

  const handleAuthSubmit = (event: React.FormEvent) => {
    if (mode === 'password') {
      void handlePasswordSubmit(event);
      return;
    }

    event.preventDefault();
    if (emailCodeStep === 'email') {
      void handleSendCode();
      return;
    }
    if (emailCodeStep === 'otp') {
      void handleEmailCodeVerify();
      return;
    }
    void handleVerifiedEmailLogin();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      onAnimationComplete={() => setIsGlassReady(true)}
      className="w-full max-w-xs"
    >
      <div className="flex flex-col gap-6">
        <form noValidate onSubmit={handleAuthSubmit} className="flex flex-col gap-6">
          <FieldGroup>
            <div className="flex flex-col items-center gap-1 text-center">
              <h1 className="select-none text-2xl font-bold">
                {mode === 'password' || emailCodeStep === 'verified-login'
                  ? 'Login to your account'
                  : emailCodeStep === 'otp'
                    ? 'Check your inbox'
                    : 'Login to your account'}
              </h1>
              <p className="select-none text-sm text-muted-foreground">
                {mode === 'email-code' && emailCodeStep === 'otp'
                  ? 'Enter your verification code.'
                  : 'Use your password or an email code.'}
              </p>
            </div>

            <Tabs value={mode} onValueChange={(value) => setMode(value as 'password' | 'email-code')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="email-code">Email Code</TabsTrigger>
              </TabsList>

              <TabsContent value="password" className="mt-4 flex flex-col gap-4">
                <Field data-invalid={fieldErrors.email ? true : undefined}>
                  <FieldLabel htmlFor={emailId} className="select-none">Email</FieldLabel>
                  <EmailDomainInput
                    id={emailId}
                    type="email"
                    value={email}
                    onValueChange={(nextValue) => {
                      setEmail(nextValue);
                      clearError('email');
                    }}
                    aria-invalid={fieldErrors.email ? true : undefined}
                  />
                  {fieldErrors.email ? <FieldDescription className="text-destructive">{fieldErrors.email}</FieldDescription> : null}
                </Field>

                <Field data-invalid={fieldErrors.password ? true : undefined}>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor={passwordId} className="select-none">Password</FieldLabel>
                    <Link
                      to="/reset-password"
                      state={{ email: email.trim() }}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id={passwordId}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        clearError('password');
                      }}
                      aria-invalid={fieldErrors.password ? true : undefined}
                      placeholder="Enter your password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex select-none items-center px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.password ? <FieldDescription className="text-destructive">{fieldErrors.password}</FieldDescription> : null}
                </Field>

                <Field>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={rememberMeId}
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                    />
                    <FieldLabel htmlFor={rememberMeId} className="select-none">Keep me signed in</FieldLabel>
                  </div>
                </Field>

                <Field>
                  <Button className="w-full" type="submit" disabled={isPasswordLoading}>
                    {isPasswordLoading ? 'Signing in...' : 'Sign in'}
                  </Button>
                </Field>
              </TabsContent>

              <TabsContent value="email-code" className="mt-4 flex flex-col gap-4">
                {emailCodeStep === 'email' ? (
                  <>
                    <Field data-invalid={fieldErrors.email ? true : undefined}>
                      <FieldLabel className="select-none">Email</FieldLabel>
                      <EmailDomainInput
                        type="email"
                        value={email}
                        onValueChange={(nextValue) => {
                          setEmail(nextValue);
                          clearError('email');
                        }}
                        aria-invalid={fieldErrors.email ? true : undefined}
                        className="h-11"
                      />
                      {fieldErrors.email ? (
                        <FieldDescription className="text-destructive">{fieldErrors.email}</FieldDescription>
                      ) : null}
                    </Field>

                    <Field>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={emailRememberMeId}
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                        />
                        <FieldLabel htmlFor={emailRememberMeId} className="select-none">Keep me signed in</FieldLabel>
                      </div>
                    </Field>

                    <Field>
                      <Button type="submit" className="w-full" disabled={isSendingCode}>
                        {isSendingCode ? 'Sending code...' : 'Continue with email code'}
                      </Button>
                    </Field>
                  </>
                ) : null}

                {emailCodeStep === 'otp' ? (
                  <>
                    <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
                      <p className="min-w-0 flex-1 truncate text-muted-foreground">
                        Code sent to <span className="font-medium text-foreground">{email}</span>
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={handleSendCode}
                        disabled={isSendingCode || cooldownRemaining > 0}
                      >
                        {isSendingCode ? 'Sending...' : cooldownRemaining > 0 ? `Resend in ${cooldownRemaining}s` : 'Resend'}
                      </Button>
                    </div>

                    <AuthCodeInput
                      value={code}
                      onChange={(value) => {
                        setCode(value);
                        clearError('code');
                      }}
                      error={fieldErrors.code}
                      description="Verification codes expire after 10 minutes."
                      disabled={isCodeLoading}
                    />

                    <Field>
                      <Button type="submit" className="w-full" disabled={isCodeLoading}>
                        {isCodeLoading ? 'Verifying...' : 'Verify code'}
                      </Button>
                    </Field>
                  </>
                ) : null}

                {emailCodeStep === 'verified-login' ? (
                  <>
                    <Field>
                      <Input value={email} readOnly disabled className="opacity-100" />
                      <FieldDescription>{handoffMessage ?? 'This verified email is ready to sign in.'}</FieldDescription>
                    </Field>

                    <Field>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`${emailRememberMeId}-verified`}
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                        />
                        <FieldLabel htmlFor={`${emailRememberMeId}-verified`} className="select-none">Keep me signed in</FieldLabel>
                      </div>
                    </Field>

                    <Field>
                      <Button type="submit" className="w-full" disabled={isVerifiedLoginLoading}>
                        {isVerifiedLoginLoading ? 'Signing in...' : 'Sign in'}
                      </Button>
                    </Field>
                  </>
                ) : null}
              </TabsContent>
            </Tabs>

            <FieldSeparator className="select-none">Or continue with</FieldSeparator>

            <Field>
              {googleClientId ? (
                <div className="relative h-11 w-full">
                  <div
                    ref={googleButtonRef}
                    className={`h-11 w-full transition-opacity duration-200 ${isGoogleReady ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {!isGoogleReady ? (
                    <div className="pointer-events-none absolute inset-0 flex select-none items-center justify-center rounded-full border border-border bg-background px-3 text-sm text-muted-foreground transition-opacity duration-200">
                      <div className="flex items-center gap-2">
                        <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground/80" />
                        <span>Continue with Google</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <Button className="w-full" variant="outline" type="button" disabled>
                  Google sign-in is not configured
                </Button>
              )}
            </Field>

            <Field>
              <FieldDescription className="px-6 text-center">
                Don&apos;t have an account? <Link to="/register" viewTransition>Create one</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </div>
    </motion.div>
  );
};
