import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SparklesIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store';

function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dashboardHref = user?.is_staff ? '/admin-panel' : '/dashboard';

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'bg-bg-primary/80 backdrop-blur-xl border-b border-white/[0.06]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-primary shadow-glow-coral flex items-center justify-center transition-transform group-hover:scale-105">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold font-heading tracking-tight text-text-primary">
            Sellanto
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link to="/about" className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary rounded-lg hover:bg-white/[0.04] transition-colors">About</Link>
          <Link to="/privacy" className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary rounded-lg hover:bg-white/[0.04] transition-colors">Privacy</Link>
          <Link to="/terms" className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary rounded-lg hover:bg-white/[0.04] transition-colors">Terms</Link>
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {isAuthenticated ? (
            <Link
              to={dashboardHref}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-primary text-white hover:opacity-90 transition-opacity"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-medium rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-primary text-white hover:opacity-90 transition-opacity"
              >
                Get Started Free
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden p-2 rounded-lg text-text-secondary hover:bg-white/[0.06]"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
        </button>
      </div>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-bg-primary/95 backdrop-blur-xl border-b border-white/[0.06]"
        >
          <div className="px-4 py-4 flex flex-col gap-1">
            <Link to="/about" onClick={() => setMobileOpen(false)} className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary rounded-lg hover:bg-white/[0.04]">About</Link>
            <Link to="/privacy" onClick={() => setMobileOpen(false)} className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary rounded-lg hover:bg-white/[0.04]">Privacy</Link>
            <Link to="/terms" onClick={() => setMobileOpen(false)} className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary rounded-lg hover:bg-white/[0.04]">Terms</Link>
            <div className="flex gap-2 pt-2">
              {isAuthenticated ? (
                <Link
                  to={dashboardHref}
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-gradient-primary text-white text-center"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-white/10 text-text-primary text-center"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-gradient-primary text-white text-center"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}

function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/[0.06] bg-bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary shadow-glow-coral flex items-center justify-center">
            <SparklesIcon className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-text-primary">Sellanto</span>
          <span className="text-xs text-text-muted">© {year}</span>
        </div>

        <div className="flex items-center gap-4 text-xs text-text-muted">
          <Link to="/about" className="hover:text-text-primary transition-colors">About</Link>
          <Link to="/privacy" className="hover:text-text-primary transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-text-primary transition-colors">Terms</Link>
          <a href="mailto:support@sellanto.com" className="hover:text-text-primary transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'rgb(var(--c-bg-primary))' }}>
      <PublicNavbar />
      <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}

export default PublicLayout;
