import { useEffect, useState } from 'react';
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

export function AuthModal({
  isOpen,
  mode,
  initialEmail,
  onClose,
  onModeChange,
}: AuthModalProps) {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

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
      setSignupSuccess(false);
      loginForm.reset();
      signupForm.reset({ email: initialEmail ?? '' });
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const onLogin = async (data: LoginFormData) => {
    try {
      await login(data);
      const currentUser = useAuthStore.getState().user;
      onClose();
      navigate(currentUser?.is_staff ? '/admin-panel' : '/dashboard');
    } catch {
      /* surfaced via store error */
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
      if (result.tokens) {
        localStorage.setItem('access_token', result.tokens.access);
        localStorage.setItem('refresh_token', result.tokens.refresh);
        await useAuthStore.getState().fetchUser();
        onClose();
        navigate('/dashboard');
      } else {
        setSignupSuccess(true);
      }
    } catch (err) {
      signupForm.setError('root', {
        message: err instanceof Error ? err.message : 'Registration failed',
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" showCloseButton>
      <div className="-mt-2">
        {/* Brand mark + heading */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-primary shadow-glow-coral flex items-center justify-center mb-3">
            <SparklesIcon className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold font-heading text-text-primary tracking-tight">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            {mode === 'login'
              ? 'Sign in to keep creating with Sellanto'
              : 'Join thousands shipping content with AI'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="relative grid grid-cols-2 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-6">
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
          {mode === 'login' ? (
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

              {error && (
                <div className="text-xs text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

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
          ) : signupSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-success flex items-center justify-center mb-4">
                <SparklesIcon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-1">
                Account requested
              </h3>
              <p className="text-sm text-text-secondary">
                Your account is awaiting approval. We'll let you know as soon as it's
                ready.
              </p>
              <Button
                variant="secondary"
                fullWidth
                size="md"
                className="mt-5"
                onClick={onClose}
              >
                Got it
              </Button>
            </motion.div>
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

              {signupForm.formState.errors.root?.message && (
                <div className="text-xs text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2">
                  {signupForm.formState.errors.root.message}
                </div>
              )}

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
