import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  EyeIcon,
  EyeSlashIcon,
  SparklesIcon,
  ShieldCheckIcon,
  BoltIcon,
  GlobeAltIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ArrowRightIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { Button, Input } from '../components/ui';
import { useAuthStore } from '../store';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  password_confirm: z.string(),
  phone: z.string().min(1, 'Phone number is required'),
}).refine((data) => data.password === data.password_confirm, {
  message: "Passwords don't match",
  path: ['password_confirm'],
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

type OtpPending = {
  user_id: number;
  email: string;
  otp_ttl_seconds: number;
};

function getAuthErrorTitle(message: string): string {
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
      initial={{ opacity: 0, y: -10, scale: 0.96 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        x: [0, -8, 8, -5, 5, 0],
      }}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={{
        opacity: { duration: 0.25 },
        y: { duration: 0.25 },
        scale: { duration: 0.25 },
        x: { duration: 0.45, ease: 'easeOut' },
      }}
      className="mb-6 relative overflow-hidden rounded-2xl border border-danger/30 bg-gradient-to-r from-danger/15 via-danger/10 to-danger/5 p-4 shadow-xl shadow-danger/10"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-danger/20 flex items-center justify-center">
          <ExclamationTriangleIcon className="w-5 h-5 text-danger" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-danger leading-tight">
            {getAuthErrorTitle(message)}
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

const features = [
  { icon: SparklesIcon, text: 'AI-Powered Captions' },
  { icon: BoltIcon, text: 'Multi-Platform Posting' },
  { icon: ShieldCheckIcon, text: 'Secure & Reliable' },
  { icon: GlobeAltIcon, text: '10+ Social Networks' },
];

export function LoginPage() {
  const location = useLocation();
  const isRegister = location.pathname === '/register';
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const { error, clearError } = useAuthStore();
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const [otpPending, setOtpPending] = useState<OtpPending | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpResending, setOtpResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!otpPending) return;
    setSecondsLeft(otpPending.otp_ttl_seconds);
    const id = window.setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [otpPending]);

  useEffect(() => {
    if (otpPending) {
      const t = window.setTimeout(() => otpInputRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
  }, [otpPending]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onLogin = async (data: LoginFormData) => {
    setLoginLoading(true);
    try {
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
        navigate(currentUser?.is_staff ? '/admin-panel' : '/dashboard');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      useAuthStore.setState({ error: message });
    } finally {
      setLoginLoading(false);
    }
  };

  const onRegister = async (data: RegisterFormData) => {
    try {
      const response = await fetch('/api/v1/auth/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        const msg = err.detail || err.username?.[0] || err.email?.[0] || err.phone?.[0] || err.password_confirm?.[0] || 'Registration failed';
        throw new Error(typeof msg === 'string' ? msg : 'Registration failed');
      }
      const result = await response.json();
      if (result.requires_verification && result.user_id) {
        setOtpPending({
          user_id: result.user_id,
          email: result.email || data.email,
          otp_ttl_seconds: result.otp_ttl_seconds ?? 60,
        });
        return;
      }
      if (result.tokens) {
        localStorage.setItem('access_token', result.tokens.access);
        localStorage.setItem('refresh_token', result.tokens.refresh);
        await useAuthStore.getState().fetchUser();
        navigate('/dashboard');
      } else {
        setRegisterSuccess(true);
      }
    } catch (err) {
      registerForm.setError('root', {
        message: err instanceof Error ? err.message : 'Registration failed',
      });
    }
  };

  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpPending) return;
    const code = otpCode.trim();
    if (code.length !== 6) { setOtpError('Enter all 6 digits.'); return; }
    setOtpSubmitting(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/v1/auth/verify-otp/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: otpPending.user_id, code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Verification failed');
      if (body?.tokens) {
        localStorage.setItem('access_token', body.tokens.access);
        localStorage.setItem('refresh_token', body.tokens.refresh);
        await useAuthStore.getState().fetchUser();
        const currentUser = useAuthStore.getState().user;
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
      if (!res.ok) throw new Error(body?.error || 'Could not resend code');
      setOtpPending({ ...otpPending, otp_ttl_seconds: body?.otp_ttl_seconds ?? 60 });
      setOtpCode('');
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setOtpResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-dark-800 to-secondary/20" />
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/30 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 py-12">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 mb-12"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow-primary">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text-primary">Sellanto</h1>
              <p className="text-text-secondary">Social Media Automation</p>
            </div>
          </motion.div>

          {/* Tagline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-4xl font-bold text-text-primary mb-4 leading-tight">
              Manage All Your<br />
              <span className="gradient-text">Social Media</span><br />
              In One Place
            </h2>
            <p className="text-lg text-text-secondary mb-8 max-w-md">
              Schedule posts, generate AI captions, and grow your audience across
              multiple platforms with our powerful automation tools.
            </p>
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 gap-4"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10"
              >
                <feature.icon className="w-5 h-5 text-primary" />
                <span className="text-sm text-text-primary font-medium">{feature.text}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center gap-8 mt-12 pt-8 border-t border-white/10"
          >
            <div>
              <p className="text-3xl font-bold gradient-text">10K+</p>
              <p className="text-sm text-text-muted">Active Users</p>
            </div>
            <div>
              <p className="text-3xl font-bold gradient-text">1M+</p>
              <p className="text-sm text-text-muted">Posts Scheduled</p>
            </div>
            <div>
              <p className="text-3xl font-bold gradient-text">99.9%</p>
              <p className="text-sm text-text-muted">Uptime</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-2xl font-bold gradient-text">Sellanto</span>
            </Link>
          </div>

          {/* Form Card */}
          <div className="bg-dark-700/50 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl">
            {!otpPending && (
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-text-primary mb-2">
                  {isRegister ? 'Create Account' : 'Welcome Back'}
                </h2>
                <p className="text-text-secondary">
                  {isRegister
                    ? 'Join thousands of social media managers'
                    : 'Sign in to manage your social media'}
                </p>
              </div>
            )}

            {/* OTP Verification Screen */}
            {otpPending ? (
              <motion.form
                key="otp"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                onSubmit={onVerifyOtp}
                className="space-y-4"
              >
                <div className="text-center mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4">
                    <ShieldCheckIcon className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-text-primary mb-2">Verify your email</h2>
                  <p className="text-text-secondary text-sm">
                    Enter the 6-digit code we sent to <span className="text-text-primary font-medium break-all">{otpPending.email}</span>
                  </p>
                </div>

                <div className="flex items-end gap-3">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">6-digit code</label>
                    <input
                      ref={otpInputRef}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="\d{6}"
                      maxLength={6}
                      placeholder="• • • • • •"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-text-primary text-center text-2xl font-mono tracking-[0.6em] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 placeholder:text-text-muted/40"
                    />
                  </div>
                  <div className={`shrink-0 w-20 h-[50px] rounded-xl border flex flex-col items-center justify-center font-mono ${secondsLeft > 0 ? 'border-primary/30 bg-primary/5 text-primary' : 'border-white/[0.06] bg-white/[0.02] text-text-muted'}`}>
                    <span className="text-[10px] uppercase tracking-[0.15em] opacity-70">{secondsLeft > 0 ? 'expires' : 'expired'}</span>
                    <span className="text-lg font-bold leading-none mt-0.5">{secondsLeft > 0 ? `0:${secondsLeft.toString().padStart(2, '0')}` : '0:00'}</span>
                  </div>
                </div>

                <AnimatePresence>
                  {otpError && <AuthAlert message={otpError} onDismiss={() => setOtpError(null)} />}
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
                    onClick={() => { setOtpPending(null); setOtpCode(''); setOtpError(null); }}
                    className="text-text-muted hover:text-text-primary transition-colors"
                  >
                    ← Use a different account
                  </button>
                  <button
                    type="button"
                    onClick={onResendOtp}
                    disabled={secondsLeft > 0 || otpResending}
                    className={`flex items-center gap-1.5 font-medium transition-colors ${secondsLeft > 0 || otpResending ? 'text-text-muted cursor-not-allowed' : 'text-primary hover:underline'}`}
                  >
                    <ArrowPathIcon className={`w-3.5 h-3.5 ${otpResending ? 'animate-spin' : ''}`} />
                    {secondsLeft > 0 ? `Resend in 0:${secondsLeft.toString().padStart(2, '0')}` : otpResending ? 'Sending…' : 'Resend code'}
                  </button>
                </div>
              </motion.form>
            ) : (
              <>
            {/* Success Message */}
            {registerSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-success/10 border border-success/20 rounded-xl"
              >
                <p className="text-sm text-success text-center">
                  Registration successful! Please wait for admin approval, then sign in.
                </p>
              </motion.div>
            )}

            {/* Error Message */}
            <AnimatePresence>
              {(error || registerForm.formState.errors.root?.message) && (
                <AuthAlert
                  message={error || registerForm.formState.errors.root?.message || ''}
                  onDismiss={() => {
                    if (error) clearError();
                    if (registerForm.formState.errors.root) registerForm.clearErrors('root');
                  }}
                />
              )}
            </AnimatePresence>

            {/* Login Form */}
            {!isRegister ? (
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-5">
                <Input
                  label="Username or Email"
                  placeholder="Enter your username or email"
                  error={loginForm.formState.errors.username?.message}
                  {...loginForm.register('username')}
                  onChange={(e) => {
                    loginForm.register('username').onChange(e);
                    if (error) clearError();
                  }}
                />

                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  error={loginForm.formState.errors.password?.message}
                  {...loginForm.register('password')}
                  onChange={(e) => {
                    loginForm.register('password').onChange(e);
                    if (error) clearError();
                  }}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-text-muted hover:text-text-primary transition-colors"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="w-5 h-5" />
                      ) : (
                        <EyeIcon className="w-5 h-5" />
                      )}
                    </button>
                  }
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-white/20 bg-dark-600 text-primary focus:ring-primary/50 focus:ring-offset-0"
                    />
                    <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                      Remember me
                    </span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary hover:text-primary-light transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button type="submit" fullWidth size="lg" isLoading={loginLoading}>
                  Sign In
                </Button>
              </form>
            ) : (
              /* Register Form */
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <Input
                  label="Username"
                  placeholder="Choose a username"
                  error={registerForm.formState.errors.username?.message}
                  {...registerForm.register('username')}
                />

                <Input
                  label="Email"
                  type="email"
                  placeholder="Enter your email"
                  error={registerForm.formState.errors.email?.message}
                  {...registerForm.register('email')}
                />

                <Input
                  label="Phone Number"
                  placeholder="Enter your phone number"
                  error={registerForm.formState.errors.phone?.message}
                  {...registerForm.register('phone')}
                />

                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password"
                  error={registerForm.formState.errors.password?.message}
                  {...registerForm.register('password')}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-text-muted hover:text-text-primary transition-colors"
                    >
                      {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                  }
                />

                <Input
                  label="Confirm Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  error={registerForm.formState.errors.password_confirm?.message}
                  {...registerForm.register('password_confirm')}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-text-muted hover:text-text-primary transition-colors"
                    >
                      {showConfirmPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                  }
                />

                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  isLoading={registerForm.formState.isSubmitting}
                >
                  Create Account
                </Button>
              </form>
            )}

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-dark-700/50 text-text-muted">
                  {isRegister ? 'Already have an account?' : "Don't have an account?"}
                </span>
              </div>
            </div>

            {/* Switch Form Link */}
            <Link to={isRegister ? '/login' : '/register'}>
              <Button variant="secondary" fullWidth>
                {isRegister ? 'Sign In Instead' : 'Create Account'}
              </Button>
            </Link>
              </>
            )}
          </div>

          {/* Footer */}
          <p className="text-center text-text-muted text-sm mt-8">
            © {new Date().getFullYear()} Sellanto. All rights reserved.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default LoginPage;
