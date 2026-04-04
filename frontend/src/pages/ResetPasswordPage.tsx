// input:  [email-code and password-reset auth endpoints, cookie-session login refresh, password policy helpers, shared auth OTP input, shared email-domain autocomplete input, and shared auth-route shell presentation]
// output: [`ResetPasswordPage` route component]
// pos:    [Password reset page that verifies email ownership with a six-digit OTP before applying a new password and restoring the session]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../contexts/AuthContext';
import { getPasswordRuleError, passwordRuleHint } from '../utils/passwordRules';
import { AuthCodeInput } from '@/components/AuthCodeInput';
import { EmailDomainInput } from '@/components/EmailDomainInput';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ResetStep = 'email' | 'code' | 'password';
type ResetPasswordLocationState = {
  email?: string;
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

function getStepTitle(step: ResetStep): string {
  switch (step) {
    case 'email':
      return 'Reset your password';
    case 'code':
      return 'Check your inbox';
    case 'password':
      return 'Choose a new password';
  }
}

function getStepDescription(step: ResetStep): string {
  switch (step) {
    case 'email':
      return 'Get a verification code by email.';
    case 'code':
      return 'Enter your verification code.';
    case 'password':
      return 'Choose a new password.';
  }
}

function getResendButtonLabel(isSendingCode: boolean, cooldownRemaining: number): string | React.ReactElement {
  if (isSendingCode) {
    return <div className="size-3.5 animate-spin rounded-full border-2 border-current/25 border-t-current" />;
  }
  if (cooldownRemaining > 0) {
    return `${cooldownRemaining}s`;
  }
  return 'Resend';
}

export function ResetPasswordPage(): React.ReactElement {
  const location = useLocation();
  const prefilledEmail = typeof (location.state as ResetPasswordLocationState | null)?.email === 'string'
    ? (location.state as ResetPasswordLocationState).email ?? ''
    : '';
  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState(prefilledEmail);
  const [code, setCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    email: null as string | null,
    code: null as string | null,
    password: null as string | null,
    confirmPassword: null as string | null,
  });
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const authPanelTransition = {
    duration: 0.2,
    ease: [0.22, 1, 0.36, 1] as const,
  };

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

  const clearError = (key: keyof typeof fieldErrors) => {
    setFieldErrors((current) => ({ ...current, [key]: null }));
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
        purpose: 'reset_password',
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
      const response = await axios.post('/api/auth/email/verify-code', {
        email,
        purpose: 'reset_password',
        code,
      });
      setVerificationToken(response.data.verification_token);
      setStep('password');
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

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = {
      email: null,
      code: null,
      password: null as string | null,
      confirmPassword: null as string | null,
    };

    const passwordError = getPasswordRuleError(newPassword);
    if (passwordError) {
      nextErrors.password = passwordError;
    }
    if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors((current) => ({ ...current, ...nextErrors }));
    if (nextErrors.password || nextErrors.confirmPassword) {
      return;
    }

    setIsResettingPassword(true);
    try {
      await axios.post('/api/auth/password-reset/complete', {
        verification_token: verificationToken,
        new_password: newPassword,
      });
      await login();
      navigate('/');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to reset the password.'));
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={authPanelTransition}
      className="w-full max-w-xs"
    >
      <div className="flex flex-col gap-6">
        <motion.form noValidate onSubmit={handleResetPassword} className="flex flex-col gap-6">
          <FieldGroup>
            <div className="flex flex-col items-center gap-1 text-center">
              <h1 className="select-none text-2xl font-bold">
                {getStepTitle(step)}
              </h1>
              <p className="select-none text-sm text-muted-foreground">
                {getStepDescription(step)}
              </p>
            </div>

            {step === 'email' ? (
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
                  />
                  {fieldErrors.email ? <FieldDescription className="text-destructive">{fieldErrors.email}</FieldDescription> : null}
                </Field>

                <Field>
                  <Button className="w-full" type="button" onClick={handleSendCode} disabled={isSendingCode}>
                    {isSendingCode ? <div className="size-4 animate-spin rounded-full border-2 border-current/25 border-t-current" /> : 'Send verification code'}
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
                  disabled={isVerifyingCode}
                />
                <Field>
                  <Button type="button" className="w-full" onClick={handleVerifyCode} disabled={isVerifyingCode}>
                    {isVerifyingCode ? 'Verifying...' : 'Verify code'}
                  </Button>
                </Field>
              </>
            ) : null}

            {step === 'password' ? (
              <>
                <Field data-invalid={fieldErrors.password ? true : undefined}>
                  <FieldLabel className="select-none">New Password</FieldLabel>
                  <TooltipProvider>
                    <Tooltip open={isPasswordFocused}>
                      <TooltipTrigger asChild>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(event) => {
                              setNewPassword(event.target.value);
                              clearError('password');
                            }}
                            onFocus={() => setIsPasswordFocused(true)}
                            onBlur={() => setIsPasswordFocused(false)}
                            aria-invalid={fieldErrors.password ? true : undefined}
                            placeholder="Create a new password"
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
                  <FieldLabel className="select-none">Confirm Password</FieldLabel>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        clearError('confirmPassword');
                      }}
                      aria-invalid={fieldErrors.confirmPassword ? true : undefined}
                      placeholder="Confirm your new password"
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
                  <Button className="w-full" type="submit" disabled={isResettingPassword}>
                    {isResettingPassword ? 'Updating...' : 'Reset password'}
                  </Button>
                </Field>
              </>
            ) : null}

            <Field>
              <FieldDescription className="whitespace-nowrap px-6 text-center">
                Already have your password? <Link to="/login" viewTransition>Sign in</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </motion.form>
      </div>
    </motion.div>
  );
}
