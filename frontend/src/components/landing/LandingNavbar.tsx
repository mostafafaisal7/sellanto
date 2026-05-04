import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SparklesIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '../ui';

interface LandingNavbarProps {
  onSignIn: () => void;
  onSignUp: () => void;
}

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#magic', label: 'Magic Mode' },
  { href: '#video', label: 'AI Video' },
  { href: '#pricing', label: 'Pricing' },
];

export function LandingNavbar({ onSignIn, onSignUp }: LandingNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
        {/* Brand */}
        <a href="#top" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-primary shadow-glow-coral flex items-center justify-center transition-transform group-hover:scale-105">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold font-heading tracking-tight text-text-primary">
            Sellanto
          </span>
        </a>

        {/* Center nav (desktop) */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-white/[0.04]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA buttons (desktop) */}
        <div className="hidden md:flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onSignIn}>
            Sign In
          </Button>
          <Button variant="primary" size="sm" onClick={onSignUp}>
            Get Started Free
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 rounded-lg text-text-secondary hover:bg-white/[0.06]"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <XMarkIcon className="w-6 h-6" />
          ) : (
            <Bars3Icon className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-bg-primary/95 backdrop-blur-xl border-b border-white/[0.06]"
        >
          <div className="px-4 py-4 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary rounded-lg hover:bg-white/[0.04]"
              >
                {link.label}
              </a>
            ))}
            <div className="flex gap-2 pt-2">
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => {
                  setMobileOpen(false);
                  onSignIn();
                }}
              >
                Sign In
              </Button>
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={() => {
                  setMobileOpen(false);
                  onSignUp();
                }}
              >
                Sign Up
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}

export default LandingNavbar;
