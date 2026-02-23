import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  EyeIcon,
  EyeSlashIcon,
  SparklesIcon,
  ShieldCheckIcon,
  BoltIcon,
  GlobeAltIcon,
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
  phone: z.string().optional(),
  company: z.string().optional(),
}).refine((data) => data.password === data.password_confirm, {
  message: "Passwords don't match",
  path: ['password_confirm'],
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

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
  const { login, isLoading, error, clearError } = useAuthStore();
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onLogin = async (data: LoginFormData) => {
    try {
      await login(data);
      // After login, check if user is staff from the store state
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.is_staff) {
        navigate('/admin-panel');
      } else {
        navigate('/');
      }
    } catch {
      // Error handled by store
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
        throw new Error(err.detail || 'Registration failed');
      }
      setRegisterSuccess(true);
    } catch (err) {
      registerForm.setError('root', {
        message: err instanceof Error ? err.message : 'Registration failed',
      });
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
          <div className="bg-dark-700/50 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
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
            {(error || registerForm.formState.errors.root) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-xl"
              >
                <p className="text-sm text-danger text-center">
                  {error || registerForm.formState.errors.root?.message}
                </p>
              </motion.div>
            )}

            {/* Login Form */}
            {!isRegister ? (
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-5">
                <Input
                  label="Username"
                  placeholder="Enter your username"
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

                <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
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

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Phone (optional)"
                    placeholder="Phone number"
                    {...registerForm.register('phone')}
                  />
                  <Input
                    label="Company (optional)"
                    placeholder="Company name"
                    {...registerForm.register('company')}
                  />
                </div>

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
