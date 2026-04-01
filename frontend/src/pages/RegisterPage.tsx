// input:  [email-code auth endpoints, cookie-session login action, optional prefilled auth-route state, password policy helpers, theme hooks, shared auth OTP input, shared email-domain autocomplete input, browser-autofill suppression attributes, Google identity button renderer, and shared auth-route shell presentation]
// output: [`RegisterPage` route component]
// pos:    [Dedicated sign-up page that keeps account-creation intent explicit, verifies mailbox ownership before profile completion, and hands verified existing accounts back into the sign-in page]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../components/ThemeProvider';
import { renderGoogleIdentityButton } from '../utils/googleIdentity';
import { getPasswordRuleError, passwordRuleHint } from '../utils/passwordRules';
import { AuthCodeInput } from '@/components/AuthCodeInput';
import { EmailDomainInput } from '@/components/EmailDomainInput';
import { Button } from '@/components/ui/button';
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

type RegisterStep = 'email' | 'code' | 'profile';
type RegisterLocationState = {
  email?: string;
  verificationToken?: string;
  message?: string;
};

type EmailCodeVerifyResponse = {
  verification_token: string;
  next_step: 'login' | 'register' | 'reset_password';
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

export const RegisterPage: React.FC = () => {
  const location = useLocation();
  const registerLocationState = (location.state as RegisterLocationState | null) ?? null;
  const prefilledEmail = typeof registerLocationState?.email === 'string'
    ? registerLocationState.email ?? ''
    : '';
  const prefilledVerificationToken = typeof registerLocationState?.verificationToken === 'string'
    ? registerLocationState.verificationToken
    : '';
  const [step, setStep] = useState<RegisterStep>(prefilledVerificationToken ? 'profile' : 'email');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState(prefilledEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationToken, setVerificationToken] = useState(prefilledVerificationToken);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({
    email: null as string | null,
    code: null as string | null,
    nickname: null as string | null,
    password: null as string | null,
    confirmPassword: null as string | null,
  });
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isCompletingRegistration, setIsCompletingRegistration] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [isGlassReady, setIsGlassReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const { login } = useAuth();
  const { theme: themeMode } = useTheme();
  const navigate = useNavigate();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const emailId = useId();
  const nicknameId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
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
    if (!googleClientId || !isGlassReady || step !== 'email') {
      return;
    }

    let cancelled = false;

    const handleGoogleCredential = async (response: { credential?: string }) => {
      if (!response?.credential) {
        toast.error('Google sign-in failed. Please try again.');
        return;
      }
      setIsGoogleLoading(true);
      try {
        await axios.post('/api/auth/google', { id_token: response.credential });
        await login();
        navigate('/');
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'Google sign-in failed.'));
      } finally {
        setIsGoogleLoading(false);
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
  }, [googleButtonTheme, googleClientId, isGlassReady, login, navigate, step]);

  const clearError = (key: keyof typeof fieldErrors) => {
    setFieldErrors((current) => ({ ...current, [key]: null }));
  };

  const resetRegistrationFlow = () => {
    setCode('');
    setNickname('');
    setPassword('');
    setConfirmPassword('');
    setVerificationToken('');
    setStep('email');
    setFieldErrors((current) => ({
      ...current,
      code: null,
      nickname: null,
      password: null,
      confirmPassword: null,
    }));
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
      setCooldownRemaining(response.data.resend_in_seconds ?? 60);
      setStep('code');
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

  const handleVerifyCode = async () => {
    if (code.trim().length !== 6) {
      setFieldErrors((current) => ({ ...current, code: 'Enter the 6-digit verification code.' }));
      return;
    }

    setIsVerifyingCode(true);
    try {
      const response = await axios.post<EmailCodeVerifyResponse>('/api/auth/email/verify-code', {
        email,
        purpose: 'continue',
        code,
      });
      if (response.data.next_step === 'login') {
        navigate('/login', {
          replace: true,
          state: {
            email,
            mode: 'email-code',
            verificationToken: response.data.verification_token,
            message: 'This email already has an account. Sign in to continue.',
          },
        });
        return;
      }
      setVerificationToken(response.data.verification_token);
      setStep('profile');
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
      setIsVerifyingCode(false);
    }
  };

  const handleCompleteRegistration = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedNickname = nickname.trim();
    const nextErrors = {
      email: null,
      code: null,
      nickname: null as string | null,
      password: null as string | null,
      confirmPassword: null as string | null,
    };

    if (!verificationToken) {
      toast.error('Your verification session is missing. Start again with your email.');
      resetRegistrationFlow();
      return;
    }
    if (!normalizedNickname) {
      nextErrors.nickname = 'Enter your nickname.';
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
      navigate('/');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to create your account.'));
    } finally {
      setIsCompletingRegistration(false);
    }
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
        <form
          noValidate
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          onSubmit={handleCompleteRegistration}
          className="flex flex-col gap-6"
        >
          <FieldGroup>
            <div className="flex flex-col items-center gap-1 text-center">
              <h1 className="select-none text-2xl font-bold">
                {step === 'email' ? 'Create your account' : step === 'code' ? 'Check your inbox' : 'Finish your profile'}
              </h1>
              <p className="select-none text-sm text-muted-foreground">
                {step === 'email'
                  ? 'Start with your email.'
                  : step === 'code'
                    ? 'Enter your verification code.'
                    : 'Choose your name and password.'}
              </p>
            </div>

            {step === 'email' ? (
              <>
                <Field data-invalid={fieldErrors.email ? true : undefined}>
                  <FieldLabel htmlFor={emailId} className="select-none">Email</FieldLabel>
                  <EmailDomainInput
                    id={emailId}
                    name="register-email"
                    type="email"
                    value={email}
                    onValueChange={(nextValue) => {
                      setEmail(nextValue);
                      clearError('email');
                    }}
                    autoComplete="off"
                    aria-invalid={fieldErrors.email ? true : undefined}
                  />
                  {fieldErrors.email ? (
                    <FieldDescription className="text-destructive">{fieldErrors.email}</FieldDescription>
                  ) : null}
                </Field>

                <Field>
                  <Button className="w-full" type="button" onClick={handleSendCode} disabled={isSendingCode || isGoogleLoading}>
                    {isSendingCode ? 'Sending code...' : 'Send verification code'}
                  </Button>
                </Field>
              </>
            ) : null}

            {step === 'code' ? (
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
                    disabled={cooldownRemaining > 0 || isSendingCode}
                    onClick={handleSendCode}
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
                  autoComplete="off"
                  error={fieldErrors.code}
                  description="Verification codes expire after 10 minutes."
                  disabled={isVerifyingCode}
                />
                <Field>
                  <Button type="button" className="w-full" onClick={handleVerifyCode} disabled={isVerifyingCode}>
                    {isVerifyingCode ? 'Verifying...' : 'Verify code'}
                  </Button>
                </Field>
              </>
            ) : null}

            {step === 'profile' ? (
              <>
                <Field data-invalid={fieldErrors.nickname ? true : undefined}>
                  <FieldLabel htmlFor={nicknameId} className="select-none">Nickname</FieldLabel>
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
                    placeholder="How should we call you?"
                  />
                  {fieldErrors.nickname ? <FieldDescription className="text-destructive">{fieldErrors.nickname}</FieldDescription> : null}
                </Field>

                <Field data-invalid={fieldErrors.password ? true : undefined}>
                  <FieldLabel htmlFor={passwordId} className="select-none">Password</FieldLabel>
                  <TooltipProvider>
                    <Tooltip open={isPasswordFocused}>
                      <TooltipTrigger asChild>
                        <div className="relative">
                          <Input
                            id={passwordId}
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
                  <FieldLabel htmlFor={confirmPasswordId} className="select-none">Confirm Password</FieldLabel>
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
                    {isCompletingRegistration ? 'Creating account...' : 'Create account'}
                  </Button>
                </Field>
              </>
            ) : null}

            {step === 'email' ? (
              <>
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
              </>
            ) : null}

            <Field>
              <FieldDescription className="px-6 text-center">
                Already have an account? <Link to="/login" viewTransition>Sign in</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </div>
    </motion.div>
  );
};
