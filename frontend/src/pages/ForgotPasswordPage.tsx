import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  EyeIcon,
  EyeSlashIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import { Button, Input } from '../components/ui';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

const resetSchema = z
  .object({
    code: z
      .string()
      .min(6, 'Enter the 6-digit code')
      .max(6, 'Enter the 6-digit code')
      .regex(/^\d{6}$/, 'Code must be 6 digits'),
    new_password: z.string().min(6, 'Password must be at least 6 characters'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
  });

type EmailFormData = z.infer<typeof emailSchema>;
type ResetFormData = z.infer<typeof resetSchema>;

type Step = 'email' | 'reset' | 'done';

function Alert({
  variant,
  message,
  onDismiss,
}: {
  variant: 'error' | 'success';
  message: string;
  onDismiss?: () => void;
}) {
  const isError = variant === 'error';
  return (
    <motion.div
      key={`${variant}-${message}`}
      initial={{ opacity: 0, y: -10, scale: 0.96 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        ...(isError ? { x: [0, -8, 8, -5, 5, 0] } : {}),
      }}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={{
        opacity: { duration: 0.25 },
        y: { duration: 0.25 },
        scale: { duration: 0.25 },
        x: { duration: 0.45, ease: 'easeOut' },
      }}
      className={`mb-6 relative overflow-hidden rounded-2xl border p-4 shadow-xl ${
        isError
          ? 'border-danger/30 bg-gradient-to-r from-danger/15 via-danger/10 to-danger/5 shadow-danger/10'
          : 'border-success/30 bg-gradient-to-r from-success/15 via-success/10 to-success/5 shadow-success/10'
      }`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
            isError ? 'bg-danger/20' : 'bg-success/20'
          }`}
        >
          {isError ? (
            <ExclamationTriangleIcon className="w-5 h-5 text-danger" />
          ) : (
            <CheckCircleIcon className="w-5 h-5 text-success" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold leading-tight ${
              isError ? 'text-danger' : 'text-success'
            }`}
          >
            {isError ? 'Something went wrong' : 'All set'}
          </p>
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">{message}</p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex-shrink-0 p-1 -m-1 rounded-md text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
            aria-label="Dismiss"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [userId, setUserId] = useState<number | null>(null);
  const [email, setEmail] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [info, setInfo] = useState<string>('');
  const [resending, setResending] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const resetForm = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  // Countdown for OTP expiry
  useEffect(() => {
    if (step !== 'reset' || secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [step, secondsLeft]);

  const requestCode = async (data: EmailFormData) => {
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/v1/auth/forgot-password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || body.detail || 'Could not send reset code.');
      }
      setUserId(body.user_id);
      setEmail(body.email || data.email);
      setUsername(body.username || '');
      setSecondsLeft(body.otp_ttl_seconds || 60);
      setInfo(
        body.email_sent
          ? `We sent a 6-digit reset code to ${body.email || data.email}.`
          : 'Code generated, but the email could not be delivered. Try resending in a moment.',
      );
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset code.');
    }
  };

  const resend = async () => {
    if (!userId || resending) return;
    setError('');
    setInfo('');
    setResending(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password/resend/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || body.detail || 'Could not resend code.');
      }
      setSecondsLeft(body.otp_ttl_seconds || 60);
      setInfo(body.email_sent ? `A fresh code is on its way to ${email}.` : 'Code generated, but email could not be sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code.');
    } finally {
      setResending(false);
    }
  };

  const submitReset = async (data: ResetFormData) => {
    if (!userId) return;
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/v1/auth/forgot-password/verify/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          code: data.code,
          new_password: data.new_password,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || body.detail || 'Could not reset password.');
      }
      setStep('done');
      // After a brief celebration, send them to login.
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password.');
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-2xl font-bold gradient-text">Sellanto</span>
          </Link>
        </div>

        <div className="bg-dark-700/50 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-primary/20 flex items-center justify-center">
              <KeyIcon className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              {step === 'email' && 'Forgot password?'}
              {step === 'reset' && 'Enter the reset code'}
              {step === 'done' && 'Password updated'}
            </h2>
            <p className="text-text-secondary text-sm">
              {step === 'email' && "Enter your account's email and we'll send a 6-digit code."}
              {step === 'reset' && (
                <>
                  We sent a code to <span className="text-text-primary font-medium">{email}</span>. Enter it
                  below along with your new password.
                </>
              )}
              {step === 'done' && 'Redirecting you to sign in…'}
            </p>
          </div>

          <AnimatePresence>
            {error && <Alert variant="error" message={error} onDismiss={() => setError('')} />}
            {info && !error && <Alert variant="success" message={info} onDismiss={() => setInfo('')} />}
          </AnimatePresence>

          {step === 'email' && (
            <form onSubmit={emailForm.handleSubmit(requestCode)} className="space-y-5">
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                leftIcon={<EnvelopeIcon className="w-5 h-5 text-text-muted" />}
                error={emailForm.formState.errors.email?.message}
                {...emailForm.register('email')}
              />
              <Button type="submit" fullWidth size="lg" isLoading={emailForm.formState.isSubmitting}>
                Send reset code
              </Button>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={resetForm.handleSubmit(submitReset)} className="space-y-5">
              <div>
                <Input
                  label="6-digit code"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  placeholder="000000"
                  error={resetForm.formState.errors.code?.message}
                  {...resetForm.register('code')}
                />
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-text-muted">
                    {secondsLeft > 0
                      ? `Code expires in ${secondsLeft}s`
                      : 'Code expired — request a new one.'}
                  </span>
                  <button
                    type="button"
                    onClick={resend}
                    disabled={resending || secondsLeft > 0}
                    className="inline-flex items-center gap-1 text-primary hover:text-primary-light transition-colors disabled:opacity-40 disabled:hover:text-primary"
                  >
                    <ArrowPathIcon className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                    {resending ? 'Sending…' : `Resend code${secondsLeft > 0 ? ` (${secondsLeft}s)` : ''}`}
                  </button>
                </div>
              </div>

              <Input
                label="New password"
                type={showNewPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                error={resetForm.formState.errors.new_password?.message}
                {...resetForm.register('new_password')}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showNewPassword ? (
                      <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                }
              />

              <Input
                label="Confirm new password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter your new password"
                error={resetForm.formState.errors.confirm_password?.message}
                {...resetForm.register('confirm_password')}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                }
              />

              <Button type="submit" fullWidth size="lg" isLoading={resetForm.formState.isSubmitting}>
                Reset password
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setError('');
                  setInfo('');
                  resetForm.reset();
                }}
                className="w-full text-center text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                Use a different email
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-16 h-16 rounded-2xl bg-success/20 flex items-center justify-center">
                <ShieldCheckIcon className="w-8 h-8 text-success" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm text-text-secondary">
                  Password updated! Sign in with your <span className="text-text-primary font-medium">username or email</span> and your new password.
                </p>
                {username && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-600 border border-white/10">
                    <span className="text-xs text-text-muted">Your username:</span>
                    <span className="text-sm font-mono font-semibold text-primary">@{username}</span>
                  </div>
                )}
              </div>
              <Button onClick={() => navigate('/login')} fullWidth size="lg">
                Go to sign in
              </Button>
            </div>
          )}
        </div>

        <Link
          to="/login"
          className="mt-6 inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to sign in
        </Link>
      </motion.div>
    </div>
  );
}

export default ForgotPasswordPage;
