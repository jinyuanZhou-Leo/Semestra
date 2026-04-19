// input:  [cookie-session login actions, password/email-code auth endpoints, auth redirect restoration, optional prefilled auth-route state, password policy helpers, theme hooks, shared auth OTP input, shared email-domain autocomplete input, browser-autofill suppression attributes, Google identity button renderer, and shared auth-route shell presentation]
// output: [`LoginPage` route component]
// pos:    [Unified public auth route that starts from a single continue screen, keeps password and email verification as separate linear branches, anchors branch back-navigation without shifting the auth stack, animates direction-aware step-to-step auth transitions, and finishes account setup only after verified email ownership]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useCallback, useEffect, useId, useState, type FormEvent, type ReactElement } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../contexts/AuthContext';
import { consumeAuthRedirectTarget } from '../utils/authRedirect';
import { renderGoogleIdentityButton } from '../utils/googleIdentity';
import { useTheme } from '../components/ThemeProvider';
import { getPasswordRuleError, passwordRuleHint } from '../utils/passwordRules';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Variants } from 'framer-motion';

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

type AuthView = 'entry' | 'password' | 'email' | 'code' | 'profile';

const AUTH_VIEW_ORDER: Record<AuthView, number> = {
  entry: 0,
  password: 1,
  email: 1,
  code: 2,
  profile: 3,
};

const authStepVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * 24,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -24,
  }),
};

const authPanelTransition = {
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1] as const,
};

const authStepTransition = {
  duration: 0.18,
  ease: 'easeInOut' as const,
};

const VIEW_HEADINGS: Record<AuthView, { title: string; subtitle: string }> = {
  entry: {
    title: 'Continue to Semestra',
    subtitle: 'Sign in or create your account with a secure sign-in method.',
  },
  password: {
    title: 'Sign in with password',
    subtitle: 'Enter your email and password to continue.',
  },
  email: {
    title: 'Continue with email',
    subtitle: 'We will send a verification code to your email address.',
  },
  code: {
    title: 'Enter verification code',
    subtitle: 'Enter the six-digit code we sent to your email address.',
  },
  profile: {
    title: 'Finish setting up your account',
    subtitle: 'Choose your name and password to complete your account.',
  },
};

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

const getInitialView = (state: LoginLocationState | null): AuthView => {
  if (typeof state?.verificationToken === 'string' && state.verificationToken) {
    return 'profile';
  }
  if (state?.mode === 'password') {
    return 'password';
  }
  if (state?.mode === 'email-code') {
    return 'email';
  }
  return 'entry';
};

function getResendButtonLabel(isSendingCode: boolean, cooldownRemaining: number): string | ReactElement {
  if (isSendingCode) {
    return <div className="size-3.5 animate-spin rounded-full border-2 border-current/25 border-t-current" />;
  }
  if (cooldownRemaining > 0) {
    return `${cooldownRemaining}s`;
  }
  return 'Resend';
}

export function LoginPage(): ReactElement {
  const location = useLocation();
  const loginLocationState = (location.state as LoginLocationState | null) ?? null;
  const prefilledEmail = typeof loginLocationState?.email === 'string' ? loginLocationState.email : '';
  const prefilledVerificationToken = typeof loginLocationState?.verificationToken === 'string'
    ? loginLocationState.verificationToken
    : '';
  const [view, setView] = useState<AuthView>(getInitialView(loginLocationState));
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationToken, setVerificationToken] = useState(prefilledVerificationToken);
  const [rememberMe, setRememberMe] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [flowMessage, setFlowMessage] = useState(loginLocationState?.message ?? null as string | null);
  const [transitionDirection, setTransitionDirection] = useState(1);
  const [fieldErrors, setFieldErrors] = useState({
    email: null as string | null,
    password: null as string | null,
    code: null as string | null,
    nickname: null as string | null,
    confirmPassword: null as string | null,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isCodeLoading, setIsCodeLoading] = useState(false);
  const [isCompletingRegistration, setIsCompletingRegistration] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const { login } = useAuth();
  const { theme: themeMode } = useTheme();
  const navigate = useNavigate();
  const [googleButtonEl, setGoogleButtonEl] = useState<HTMLDivElement | null>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const emailId = useId();
  const passwordId = useId();
  const rememberMeId = useId();
  const profileEmailId = useId();
  const nicknameId = useId();
  const profilePasswordId = useId();
  const confirmPasswordId = useId();
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

  const prefersDark = themeMode === 'dark'
    || (themeMode === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const googleButtonTheme = prefersDark ? 'filled_black' : 'outline';

  useEffect(() => {
    if (!googleClientId || !googleButtonEl) {
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
      if (cancelled) {
        return;
      }

      try {
        const buttonWidth = Math.floor(googleButtonEl.getBoundingClientRect().width);
        await renderGoogleIdentityButton(
          googleButtonEl,
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
        if (!cancelled) {
          setIsGoogleReady(true);
        }
      });
    };

    void initGoogle();

    return () => {
      cancelled = true;
      setIsGoogleReady(false);
    };
  }, [googleButtonTheme, googleClientId, googleButtonEl, login, navigate, resolvePostLoginTarget]);

  const clearError = (key: keyof typeof fieldErrors) => {
    setFieldErrors((current) => ({ ...current, [key]: null }));
  };

  const navigateAuthView = (nextView: AuthView) => {
    setTransitionDirection(AUTH_VIEW_ORDER[nextView] >= AUTH_VIEW_ORDER[view] ? 1 : -1);
    setView(nextView);
  };

  const resetEmailBranch = () => {
    setCode('');
    setNickname('');
    setPassword('');
    setConfirmPassword('');
    setVerificationToken('');
    setFlowMessage(null);
    setFieldErrors((current) => ({
      ...current,
      code: null,
      password: null,
      nickname: null,
      confirmPassword: null,
    }));
  };

  const completeEmailLogin = async (token: string) => {
    await axios.post('/api/auth/login/email', {
      verification_token: token,
      remember_me: rememberMe,
    });
    await login();
    navigate(resolvePostLoginTarget(), { replace: true });
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors = {
      email: null as string | null,
      password: null as string | null,
      code: null as string | null,
      nickname: null as string | null,
      confirmPassword: null as string | null,
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
      setFlowMessage(null);
      setCooldownRemaining(response.data.resend_in_seconds ?? 60);
      navigateAuthView('code');
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
        setVerificationToken(verifyResponse.data.verification_token);
        navigateAuthView('profile');
        setFieldErrors((current) => ({
          ...current,
          code: null,
        }));
        return;
      }

      if (verifyResponse.data.next_step !== 'login') {
        throw new Error('Unexpected auth continuation step.');
      }

      await completeEmailLogin(verifyResponse.data.verification_token);
    } catch (error) {
      const message = getApiErrorMessage(error, 'Invalid or expired verification code.');
      setFieldErrors((current) => ({
        ...current,
        code: message,
      }));
    } finally {
      setIsCodeLoading(false);
    }
  };

  const handleCompleteRegistration = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedNickname = nickname.trim();
    const nextErrors = {
      email: null as string | null,
      password: null as string | null,
      code: null as string | null,
      nickname: null as string | null,
      confirmPassword: null as string | null,
    };

    if (!verificationToken) {
      toast.error('Your verification session expired. Start again with your email.');
      resetEmailBranch();
      navigateAuthView('email');
      return;
    }
    if (!normalizedNickname) {
      nextErrors.nickname = 'Enter your name.';
    }
    const passwordError = getPasswordRuleError(password);
    if (passwordError) {
      nextErrors.password = passwordError;
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors((current) => ({ ...current, ...nextErrors }));
    if (nextErrors.nickname || nextErrors.password || nextErrors.confirmPassword) {
      return;
    }

    setIsCompletingRegistration(true);
    try {
      await axios.post('/api/auth/register/complete', {
        verification_token: verificationToken,
        nickname: normalizedNickname,
        password,
      });
      await login();
      navigate(resolvePostLoginTarget(), { replace: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to finish setting up your account.'));
    } finally {
      setIsCompletingRegistration(false);
    }
  };

  const handlePrimarySubmit = (event: FormEvent) => {
    if (view === 'password') {
      void handlePasswordSubmit(event);
      return;
    }
    if (view === 'profile') {
      void handleCompleteRegistration(event);
      return;
    }
    if (view === 'email') {
      event.preventDefault();
      void handleSendCode();
      return;
    }
    if (view === 'code') {
      event.preventDefault();
      void handleEmailCodeVerify();
      return;
    }

    event.preventDefault();
  };

  const headingContent = VIEW_HEADINGS[view];

  const showTopBack = view === 'password' || view === 'email';
  const handleTopBack = () => {
    if (view === 'email') {
      resetEmailBranch();
    }
    navigateAuthView('entry');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={authPanelTransition}
      className="relative min-h-[24rem] w-full max-w-xs"
    >
      <motion.div
        aria-hidden={!showTopBack}
        initial={false}
        animate={{ opacity: showTopBack ? 1 : 0 }}
        transition={authStepTransition}
        className={`absolute -top-10 -left-2 z-10 ${
          showTopBack ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
          onClick={handleTopBack}
          tabIndex={showTopBack ? 0 : -1}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
      </motion.div>

      <div className="flex flex-col gap-6">
        <motion.form
          noValidate
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          onSubmit={handlePrimarySubmit}
          className="flex flex-col gap-6"
        >
          <FieldGroup>
            <AnimatePresence mode="wait" initial={false} custom={transitionDirection}>
              <motion.div
                key={view}
                custom={transitionDirection}
                variants={authStepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={authStepTransition}
                className="flex flex-col gap-6"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h1 className="select-none whitespace-nowrap text-[1.375rem] font-bold tracking-tight">{headingContent.title}</h1>
                    <p className="select-none whitespace-nowrap text-[13px] text-muted-foreground">{headingContent.subtitle}</p>
                  </div>
                </div>

                {view === 'entry' ? (
                  <>
                <Field>
                  {googleClientId ? (
                    <div className="relative h-11 w-full">
                      <div
                        ref={setGoogleButtonEl}
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

                <FieldSeparator className="select-none">or</FieldSeparator>

                <Field>
                  <Button
                    className="h-11 w-full justify-center gap-2.5 rounded-full border-border bg-background text-foreground hover:bg-muted/70"
                    type="button"
                    variant="outline"
                    onClick={() => navigateAuthView('email')}
                  >
                    <Mail className="h-4 w-4" />
                    Continue with email
                  </Button>
                </Field>

                <Field>
                  <Button
                    className="h-11 w-full justify-center gap-2.5 rounded-full border-border bg-background text-foreground hover:bg-muted/70"
                    type="button"
                    variant="outline"
                    onClick={() => navigateAuthView('password')}
                  >
                    <KeyRound className="h-4 w-4" />
                    Sign in with password
                  </Button>
                </Field>
                  </>
                ) : null}

                {view === 'password' ? (
                  <>
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

                  </>
                ) : null}

                {view === 'email' ? (
                  <>
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

                <Field>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`${rememberMeId}-email`}
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                    />
                    <FieldLabel htmlFor={`${rememberMeId}-email`} className="select-none">Keep me signed in</FieldLabel>
                  </div>
                </Field>

                <Field>
                  <Button className="w-full" type="submit" disabled={isSendingCode}>
                    {isSendingCode ? <div className="size-4 animate-spin rounded-full border-2 border-current/25 border-t-current" /> : 'Continue'}
                  </Button>
                </Field>

                  </>
                ) : null}

                {view === 'code' ? (
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
                    {getResendButtonLabel(isSendingCode, cooldownRemaining)}
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
                    {isCodeLoading ? 'Verifying...' : 'Continue'}
                  </Button>
                </Field>

                <div className="flex justify-center">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
                    onClick={() => {
                      setCode('');
                      clearError('code');
                      navigateAuthView('email');
                    }}
                  >
                    Change email
                  </button>
                </div>
                  </>
                ) : null}

                {view === 'profile' ? (
                  <>
                <Field data-invalid={fieldErrors.email ? true : undefined}>
                  <FieldLabel htmlFor={profileEmailId} className="select-none">Verified email</FieldLabel>
                  <Input id={profileEmailId} value={email} readOnly disabled className="opacity-100" />
                  <FieldDescription>
                    {flowMessage ?? 'This email is verified and ready for account setup.'}
                  </FieldDescription>
                </Field>

                <Field data-invalid={fieldErrors.nickname ? true : undefined}>
                  <FieldLabel htmlFor={nicknameId} className="select-none">Name</FieldLabel>
                  <Input
                    id={nicknameId}
                    name="register-nickname"
                    type="text"
                    value={nickname}
                    onChange={(event) => {
                      setNickname(event.target.value);
                      clearError('nickname');
                    }}
                    autoComplete="off"
                    data-1p-ignore="true"
                    data-form-type="other"
                    data-lpignore="true"
                    aria-invalid={fieldErrors.nickname ? true : undefined}
                    placeholder="Enter your name"
                  />
                  {fieldErrors.nickname ? <FieldDescription className="text-destructive">{fieldErrors.nickname}</FieldDescription> : null}
                </Field>

                <Field data-invalid={fieldErrors.password ? true : undefined}>
                  <FieldLabel htmlFor={profilePasswordId} className="select-none">Password</FieldLabel>
                  <TooltipProvider>
                    <Tooltip open={isPasswordFocused}>
                      <TooltipTrigger asChild>
                        <div className="relative">
                          <Input
                            id={profilePasswordId}
                            name="register-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(event) => {
                              setPassword(event.target.value);
                              clearError('password');
                            }}
                            onFocus={() => setIsPasswordFocused(true)}
                            onBlur={() => setIsPasswordFocused(false)}
                            autoComplete="new-password"
                            data-1p-ignore="true"
                            data-form-type="other"
                            data-lpignore="true"
                            aria-invalid={fieldErrors.password ? true : undefined}
                            placeholder="Create a password"
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
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" className="max-w-[300px] text-xs">
                        {passwordRuleHint}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {fieldErrors.password ? <FieldDescription className="text-destructive">{fieldErrors.password}</FieldDescription> : null}
                </Field>

                <Field data-invalid={fieldErrors.confirmPassword ? true : undefined}>
                  <FieldLabel htmlFor={confirmPasswordId} className="select-none">Confirm password</FieldLabel>
                  <div className="relative">
                    <Input
                      id={confirmPasswordId}
                      name="register-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        clearError('confirmPassword');
                      }}
                      autoComplete="new-password"
                      data-1p-ignore="true"
                      data-form-type="other"
                      data-lpignore="true"
                      aria-invalid={fieldErrors.confirmPassword ? true : undefined}
                      placeholder="Confirm your password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex select-none items-center px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
                      onClick={() => setShowConfirmPassword((current) => !current)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword ? <FieldDescription className="text-destructive">{fieldErrors.confirmPassword}</FieldDescription> : null}
                </Field>

                <Field>
                  <Button className="w-full" type="submit" disabled={isCompletingRegistration}>
                    {isCompletingRegistration ? 'Finishing setup...' : 'Continue'}
                  </Button>
                </Field>

                <div className="flex justify-center">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
                    onClick={() => {
                      resetEmailBranch();
                      navigateAuthView('email');
                    }}
                  >
                    Start over
                  </button>
                </div>
                  </>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </FieldGroup>
        </motion.form>
      </div>
    </motion.div>
  );
}
