import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Button } from '../components/ui';

export function CancelPage() {
  const navigate = useNavigate();
  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl border border-white/[0.08] bg-bg-card p-8 md:p-10 text-center"
      >
        <div className="w-16 h-16 mx-auto rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-5">
          <XCircleIcon className="w-8 h-8 text-text-secondary" />
        </div>

        <h1 className="text-2xl md:text-3xl font-extrabold font-heading text-text-primary mb-2">
          Payment cancelled
        </h1>
        <p className="text-sm text-text-secondary mb-6">
          You weren't charged. Your plan is unchanged. You can try again whenever you're ready.
        </p>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            fullWidth
            leftIcon={<ArrowLeftIcon className="w-4 h-4" />}
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </Button>
          <Button fullWidth onClick={() => navigate('/upgrade')}>
            Back to plans
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default CancelPage;
