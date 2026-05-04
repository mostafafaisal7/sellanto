import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { Button } from '../ui';

interface FinalCTASectionProps {
  onSubmit: (email: string) => void;
}

export function FinalCTASection({ onSubmit }: FinalCTASectionProps) {
  const [email, setEmail] = useState('');

  const handle = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(email);
  };

  return (
    <section className="relative py-24 md:py-32">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="relative rounded-[32px] overflow-hidden border border-white/[0.08]"
        >
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-coral/30 via-purple/20 to-amber/30" />
          <div className="absolute inset-0 bg-bg-card/40 backdrop-blur-sm" />
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-coral/40 blur-[120px] rounded-full" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple/40 blur-[120px] rounded-full" />

          <div className="relative px-6 py-16 md:px-16 md:py-24 text-center">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-coral">
              Free forever — no card required
            </span>
            <h2 className="mt-4 text-4xl md:text-6xl font-extrabold font-heading text-text-primary tracking-tight leading-[1.05]">
              Stop staring at the{' '}
              <span className="bg-gradient-to-r from-coral via-amber to-purple bg-clip-text text-transparent">
                blank page.
              </span>
            </h2>
            <p className="mt-5 max-w-xl mx-auto text-lg text-text-secondary leading-relaxed">
              Drop your email and create your first AI post in under two minutes.
            </p>

            <form
              onSubmit={handle}
              className="mt-10 max-w-md mx-auto flex flex-col sm:flex-row gap-3"
            >
              <div className="relative flex-1">
                <EnvelopeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-bg-primary/70 backdrop-blur-sm border border-white/[0.08] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-coral/50 focus:shadow-[0_0_0_3px_rgba(232,54,79,0.15)] transition-all"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                rightIcon={<ArrowRightIcon className="w-4 h-4" />}
              >
                Create my first post
              </Button>
            </form>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-text-muted">
              <span>✓ Magic Mode included</span>
              <span>✓ AI Video &amp; Image quotas</span>
              <span>✓ 8 platforms connected</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default FinalCTASection;
