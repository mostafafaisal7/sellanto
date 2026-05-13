import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SparklesIcon, ArrowRightIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Button } from '../components/ui';
import { BuyDiamondsModal } from '../components/billing/BuyDiamondsModal';

export function BuyDiamondsPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 space-y-6">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-coral">Diamonds</span>
        <h1 className="mt-2 text-3xl md:text-4xl font-extrabold font-heading text-text-primary tracking-tight">
          Top up your wallet 💎
        </h1>
        <p className="mt-2 text-sm md:text-base text-text-secondary max-w-2xl">
          Diamonds power Magic Mode, AI captions, AI images, AI videos, Messenger replies, and ad
          boosts. Pick any amount — they never expire.
        </p>
      </motion.header>

      {/* CTA card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-3xl border border-white/[0.08] bg-bg-card p-8 flex flex-col items-center gap-5 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-primary shadow-glow-coral flex items-center justify-center">
          <SparklesIcon className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-1">Choose your amount</h2>
          <p className="text-sm text-text-secondary">
            Enter any USD amount — see exactly how many diamonds you'll get instantly.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => setOpen(true)}
          rightIcon={<ArrowRightIcon className="w-4 h-4" />}
        >
          Open top-up
        </Button>
      </motion.div>

      {/* Trust */}
      <div className="rounded-2xl border border-white/[0.06] bg-bg-card/70 p-5 flex items-start gap-3">
        <ShieldCheckIcon className="w-5 h-5 text-green flex-shrink-0 mt-0.5" />
        <div className="text-sm text-text-secondary">
          Payments are processed by <strong className="text-text-primary">Stripe</strong>.
          Your card details never touch our servers. Diamonds never expire.
        </div>
      </div>

      <div className="text-center flex justify-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          Back to dashboard
        </Button>
        <Button variant="ghost" onClick={() => navigate('/settings/payments')}>
          Payment history
        </Button>
      </div>

      <BuyDiamondsModal
        isOpen={open}
        onClose={() => { setOpen(false); navigate('/dashboard'); }}
        onSuccess={() => { setOpen(false); navigate('/dashboard'); }}
      />
    </div>
  );
}

export default BuyDiamondsPage;
