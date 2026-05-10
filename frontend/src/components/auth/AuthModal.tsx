import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  EyeIcon,
  EyeSlashIcon,
  EnvelopeIcon,
  LockClosedIcon,
  UserIcon,
  PhoneIcon,
  ArrowRightIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { Modal, Button, Input } from '../ui';
import { useAuthStore } from '../../store';

export type AuthMode = 'login' | 'signup';

interface AuthModalProps {
  isOpen: boolean;
  mode: AuthMode;
  initialEmail?: string;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
}

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const signupSchema = z
  .object({
    username: z.string().min(3, 'At least 3 characters'),
    email: z.string().email('Please enter a valid email'),
    phone: z.string().min(1, 'Phone is required'),
    password: z.string().min(6, 'At least 6 characters'),
    password_confirm: z.string(),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: "Passwords don't match",
    path: ['password_confirm'],
  });

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

function getErrorTitle(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid') && (m.includes('password') || m.includes('username') || m.includes('credential'))) {
    return 'Wrong credentials';
  }
  if (m.includes('approval') || m.includes('approved')) return 'Awaiting approval';
  if (m.includes('network') || m.includes('fetch')) return 'Connection issue';
  if (m.includes('exists') || m.includes('already')) return 'Account already exists';
  return 'Something went wrong';
}

function AuthAlert({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <motion.div
      key={message}
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        x: [0, -6, 6, -4, 4, 0],
      }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{
        opacity: { duration: 0.2 },
        y: { duration: 0.2 },
        scale: { duration: 0.2 },
        x: { duration: 0.4, ease: 'easeOut' },
      }}
      className="relative overflow-hidden rounded-xl border border-coral/30 bg-gradient-to-r from-coral/15 via-coral/10 to-coral/5 p-3.5 shadow-lg shadow-coral/10"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-coral/20 flex items-center justify-center">
          <ExclamationTriangleIcon className="w-4 h-4 text-coral" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-coral leading-tight">
            {getErrorTitle(message)}
          </p>
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">
            {message}
          </p>
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

type OtpPending = {
  user_id: number;
  email: string;
  otp_ttl_seconds: number;
};

export function AuthModal({
  isOpen,
  mode,
  initialEmail,
  onClose,
  onModeChange,
}: AuthModalProps) {
  const navigate = useNavigate();
  const { isLoading, error, clearError } = useAuthStore();
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  // OTP step — set after a successful signup or after a login that returned
  // 403 requires_verification. While non-null we render the OTP screen.
  const [otpPending, setOtpPending] = useState<OtpPending | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpResending, setOtpResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  const loginForm = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });
  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: initialEmail ?? '' },
  });

  useEffect(() => {
    if (initialEmail) signupForm.setValue('email', initialEmail);
  }, [initialEmail, signupForm]);

  useEffect(() => {
    if (!isOpen) {
      clearError();
      setOtpPending(null);
      setOtpCode('');
      setOtpError(null);
      setSecondsLeft(0);
      loginForm.reset();
      signupForm.reset({ email: initialEmail ?? '' });
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reverse-countdown ticker. Reset whenever otpPending changes (new signup
  // or resend). The expiry is enforced by the server; this is just UI.
  useEffect(() => {
    if (!otpPending) return;
    setSecondsLeft(otpPending.otp_ttl_seconds);
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [otpPending]);

  // Auto-focus the OTP input when the screen appears.
  useEffect(() => {
    if (otpPending) {
      const t = window.setTimeout(() => otpInputRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
  }, [otpPending]);

  const onLogin = async (data: LoginFormData) => {
    try {
      // Direct fetch so we can read the 403 requires_verification payload —
      // the store's login() throws on non-2xx and discards the body.
      const res = await fetch('/api/v1/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403 && body?.requires_verification) {
        setOtpPending({
          user_id: body.user_id,
          email: body.email,
          otp_ttl_seconds: body.otp_ttl_seconds ?? 60,
        });
        return;
      }
      if (!res.ok) {
        throw new Error(body?.error || body?.detail || 'Login failed');
      }
      if (body?.tokens) {
        localStorage.setItem('access_token', body.tokens.access);
        localStorage.setItem('refresh_token', body.tokens.refresh);
        await useAuthStore.getState().fetchUser();
        const currentUser = useAuthStore.getState().user;
        onClose();
        navigate(currentUser?.is_staff ? '/admin-panel' : '/dashboard');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      useAuthStore.setState({ error: message });
    }
  };

  const onSignup = async (data: SignupFormData) => {
    try {
      const res = await fetch('/api/v1/auth/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        const msg =
          err.detail ||
          err.username?.[0] ||
          err.email?.[0] ||
          err.phone?.[0] ||
          err.password_confirm?.[0] ||
          'Registration failed';
        throw new Error(typeof msg === 'string' ? msg : 'Registration failed');
      }
      const result = await res.json();
      // New flow: backend always returns requires_verification + user_id.
      if (result.requires_verification && result.user_id) {
        setOtpPending({
          user_id: result.user_id,
          email: result.email || data.email,
          otp_ttl_seconds: result.otp_ttl_seconds ?? 60,
        });
        return;
      }
      // Legacy path — backend returned tokens directly.
      if (result.tokens) {
        localStorage.setItem('access_token', result.tokens.access);
        localStorage.setItem('refresh_token', result.tokens.refresh);
        await useAuthStore.getState().fetchUser();
        onClose();
        navigate('/dashboard');
      }
    } catch (err) {
      signupForm.setError('root', {
        message: err instanceof Error ? err.message : 'Registration failed',
      });
    }
  };

  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpPending) return;
    const code = otpCode.trim();
    if (code.length !== 6) {
      setOtpError('Enter all 6 digits.');
      return;
    }
    setOtpSubmitting(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/v1/auth/verify-otp/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: otpPending.user_id, code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || 'Verification failed');
      }
      if (body?.tokens) {
        localStorage.setItem('access_token', body.tokens.access);
        localStorage.setItem('refresh_token', body.tokens.refresh);
        await useAuthStore.getState().fetchUser();
        const currentUser = useAuthStore.getState().user;
        onClose();
        navigate(currentUser?.is_staff ? '/admin-panel' : '/dashboard');
      }
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setOtpSubmitting(false);
    }
  };

  const onResendOtp = async () => {
    if (!otpPending || secondsLeft > 0 || otpResending) return;
    setOtpResending(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/v1/auth/resend-otp/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: otpPending.user_id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || 'Could not resend code');
      }
      // Re-arm countdown by setting otpPending again (same id, fresh ttl).
      setOtpPending({
        ...otpPending,
        otp_ttl_seconds: body?.otp_ttl_seconds ?? 60,
      });
      setOtpCode('');
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setOtpResending(false);
    }
  };

  const showOtp = otpPending !== null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" showCloseButton>
      <div className="-mt-2">
        {/* Brand mark + heading */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-primary shadow-glow-coral flex items-center justify-center mb-3">
            {showOtp ? (
              <ShieldCheckIcon className="w-6 h-6 text-white" />
            ) : (
              <SparklesIcon className="w-6 h-6 text-white" />
            )}
          </div>
          <h2 className="text-2xl font-bold font-heading text-text-primary tracking-tight">
            {showOtp
              ? 'Verify your email'
              : mode === 'login'
                ? 'Welcome back'
                : 'Create your account'}
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            {showOtp
              ? `Enter the 6-digit code we sent to ${otpPending?.email}`
              : mode === 'login'
                ? 'Sign in to keep creating with Sellanto'
                : 'Join thousands shipping content with AI'}
          </p>
        </div>

        {/* Mode toggle — hidden during OTP step */}
        <div
          className="relative grid grid-cols-2 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-6"
          style={{ display: showOtp ? 'none' : undefined }}
        >
          <motion.div
            layout
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-gradient-primary shadow-glow-coral"
            style={{ left: mode === 'login' ? 4 : 'calc(50% + 0px)' }}
          />
          <button
            type="button"
            onClick={() => onModeChange('login')}
            className={`relative z-10 py-2 text-sm font-semibold transition-colors ${
              mode === 'login' ? 'text-white' : 'text-text-secondary'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => onModeChange('signup')}
            className={`relative z-10 py-2 text-sm font-semibold transition-colors ${
              mode === 'signup' ? 'text-white' : 'text-text-secondary'
            }`}
          >
            Sign Up
          </button>
        </div>

        <AnimatePresence mode="wait">
          {showOtp ? (
            <motion.form
              key="otp"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              onSubmit={onVerifyOtp}
              className="space-y-4"
            >
              {/* OTP digits + reverse countdown side-by-side */}
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    6-digit code
                  </label>
                  <input
                    ref={otpInputRef}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    placeholder="• • • • • •"
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-text-primary text-center text-2xl font-mono tracking-[0.6em] focus:outline-none focus:border-coral focus:ring-2 focus:ring-coral/30 placeholder:text-text-muted/40"
                  />
                </div>
                {/* Reverse second-counter, sits next to the OTP field */}
                <div
                  className={`shrink-0 w-20 h-[50px] rounded-xl border flex flex-col items-center justify-center font-mono ${
                    secondsLeft > 0
                      ? 'border-coral/30 bg-coral/5 text-coral'
                      : 'border-white/[0.06] bg-white/[0.02] text-text-muted'
                  }`}
                  aria-live="polite"
                  title={secondsLeft > 0 ? 'Code expires in' : 'Code expired'}
                >
                  <span className="text-[10px] uppercase tracking-[0.15em] opacity-70">
                    {secondsLeft > 0 ? 'expires' : 'expired'}
                  </span>
                  <span className="text-lg font-bold leading-none mt-0.5">
                    {secondsLeft > 0 ? `0:${secondsLeft.toString().padStart(2, '0')}` : '0:00'}
                  </span>
                </div>
              </div>

              <AnimatePresence>
                {otpError && (
                  <AuthAlert
                    message={otpError}
                    onDismiss={() => setOtpError(null)}
                  />
                )}
              </AnimatePresence>

              <Button
                type="submit"
                fullWidth
                size="lg"
                isLoading={otpSubmitting}
                disabled={otpCode.length !== 6}
                rightIcon={<ArrowRightIcon className="w-4 h-4" />}
              >
                Verify &amp; continue
              </Button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setOtpPending(null);
                    setOtpCode('');
                    setOtpError(null);
                  }}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  ← Use a different account
                </button>
                <button
                  type="button"
                  onClick={onResendOtp}
                  disabled={secondsLeft > 0 || otpResending}
                  className={`flex items-center gap-1.5 font-medium transition-colors ${
                    secondsLeft > 0 || otpResending
                      ? 'text-text-muted cursor-not-allowed'
                      : 'text-coral hover:underline'
                  }`}
                >
                  <ArrowPathIcon
                    className={`w-3.5 h-3.5 ${otpResending ? 'animate-spin' : ''}`}
                  />
                  {secondsLeft > 0
                    ? `Resend in 0:${secondsLeft.toString().padStart(2, '0')}`
                    : otpResending
                      ? 'Sending…'
                      : 'Resend code'}
                </button>
              </div>
            </motion.form>
          ) : mode === 'login' ? (
            <motion.form
              key="login"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2 }}
              onSubmit={loginForm.handleSubmit(onLogin)}
              className="space-y-4"
            >
              <Input
                label="Username"
                placeholder="your_username"
                autoComplete="username"
                leftIcon={<UserIcon className="w-4 h-4" />}
                error={loginForm.formState.errors.username?.message}
                {...loginForm.register('username')}
              />
              <Input
                label="Password"
                type={showPwd ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                leftIcon={<LockClosedIcon className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="text-text-muted hover:text-text-primary"
                    tabIndex={-1}
                  >
                    {showPwd ? (
                      <EyeSlashIcon className="w-4 h-4" />
                    ) : (
                      <EyeIcon className="w-4 h-4" />
                    )}
                  </button>
                }
                error={loginForm.formState.errors.password?.message}
                {...loginForm.register('password')}
              />

              <AnimatePresence>
                {error && <AuthAlert message={error} onDismiss={clearError} />}
              </AnimatePresence>

              <Button
                type="submit"
                fullWidth
                size="lg"
                isLoading={isLoading}
                rightIcon={<ArrowRightIcon className="w-4 h-4" />}
              >
                Sign In
              </Button>

              <p className="text-center text-xs text-text-muted">
                Need the full-page experience?{' '}
                <a
                  href="/login"
                  className="text-coral hover:underline"
                >
                  Open /login
                </a>
              </p>
            </motion.form>
          ) : (
            <motion.form
              key="signup"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              onSubmit={signupForm.handleSubmit(onSignup)}
              className="space-y-3.5"
            >
              <Input
                label="Username"
                placeholder="your_username"
                autoComplete="username"
                leftIcon={<UserIcon className="w-4 h-4" />}
                error={signupForm.formState.errors.username?.message}
                {...signupForm.register('username')}
              />
              <Input
                label="Email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                leftIcon={<EnvelopeIcon className="w-4 h-4" />}
                error={signupForm.formState.errors.email?.message}
                {...signupForm.register('email')}
              />
              <Input
                label="Phone"
                placeholder="+8801..."
                autoComplete="tel"
                leftIcon={<PhoneIcon className="w-4 h-4" />}
                error={signupForm.formState.errors.phone?.message}
                {...signupForm.register('phone')}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  leftIcon={<LockClosedIcon className="w-4 h-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="text-text-muted hover:text-text-primary"
                      tabIndex={-1}
                    >
                      {showPwd ? (
                        <EyeSlashIcon className="w-4 h-4" />
                      ) : (
                        <EyeIcon className="w-4 h-4" />
                      )}
                    </button>
                  }
                  error={signupForm.formState.errors.password?.message}
                  {...signupForm.register('password')}
                />
                <Input
                  label="Confirm"
                  type={showPwd2 ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  leftIcon={<LockClosedIcon className="w-4 h-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPwd2((v) => !v)}
                      className="text-text-muted hover:text-text-primary"
                      tabIndex={-1}
                    >
                      {showPwd2 ? (
                        <EyeSlashIcon className="w-4 h-4" />
                      ) : (
                        <EyeIcon className="w-4 h-4" />
                      )}
                    </button>
                  }
                  error={signupForm.formState.errors.password_confirm?.message}
                  {...signupForm.register('password_confirm')}
                />
              </div>

              <AnimatePresence>
                {signupForm.formState.errors.root?.message && (
                  <AuthAlert
                    message={signupForm.formState.errors.root.message}
                    onDismiss={() => signupForm.clearErrors('root')}
                  />
                )}
              </AnimatePresence>

              <Button
                type="submit"
                fullWidth
                size="lg"
                isLoading={signupForm.formState.isSubmitting}
                rightIcon={<ArrowRightIcon className="w-4 h-4" />}
              >
                Create account
              </Button>

              <p className="text-center text-[11px] text-text-muted leading-relaxed">
                By creating an account you agree to our{' '}
                <a href="/terms" className="text-text-secondary hover:text-coral underline">
                  Terms
                </a>{' '}
                &amp;{' '}
                <a href="/privacy" className="text-text-secondary hover:text-coral underline">
                  Privacy Policy
                </a>
                .
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}

export default AuthModal;
