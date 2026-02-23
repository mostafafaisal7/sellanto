import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { SparklesIcon, ArrowUpCircleIcon } from '@heroicons/react/24/solid';
import type { SubscriptionPlan } from '../../types';

interface SubscriptionInfoProps {
  plan: SubscriptionPlan;
  maxAccounts: number;
  maxPostsPerMonth: number;
  postsThisMonth: number;
}

const planColors: Record<SubscriptionPlan, string> = {
  free: 'bg-dark-600 text-text-muted',
  starter: 'bg-info/10 text-info border-info/20',
  pro: 'bg-primary/10 text-primary border-primary/20',
  business: 'bg-secondary/10 text-secondary border-secondary/20',
  enterprise: 'bg-accent/10 text-accent border-accent/20',
};

const planLabels: Record<SubscriptionPlan, string> = {
  free: 'Free Explorer',
  starter: 'Starter Growth',
  pro: 'Professional Plus',
  business: 'Business Suite',
  enterprise: 'Enterprise Elite',
};

export function SubscriptionInfo({
  plan,
  maxAccounts,
  maxPostsPerMonth,
  postsThisMonth,
}: SubscriptionInfoProps) {
  const remainingPosts = Math.max(0, maxPostsPerMonth - postsThisMonth);
  const usagePercentage = Math.min(100, (postsThisMonth / maxPostsPerMonth) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card overflow-hidden group border-white/5 bg-dark-800/80 backdrop-blur-xl"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-accent opacity-50" />

      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-1">Current Membership</p>
            <h2 className="text-xl font-black text-text-primary flex items-center gap-2">
              {planLabels[plan]}
              {plan !== 'free' && <SparklesIcon className="w-5 h-5 text-warning" />}
            </h2>
          </div>
          <span className={clsx(
            'px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border',
            planColors[plan]
          )}>
            {plan}
          </span>
        </div>

        <div className="space-y-6">
          {/* Usage Meter */}
          <div>
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-text-secondary">Monthly Posts Usage</span>
              <span className={clsx(usagePercentage > 90 ? "text-error" : "text-text-primary")}>
                {postsThisMonth} / {maxPostsPerMonth}
              </span>
            </div>
            <div className="h-2.5 bg-dark-900 rounded-full overflow-hidden p-[2px]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usagePercentage}%` }}
                className={clsx(
                  "h-full rounded-full bg-gradient-to-r",
                  usagePercentage > 90 ? "from-error to-error/50" : "from-primary to-secondary"
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-dark-900/50 p-4 rounded-2xl border border-white/5 flex flex-col items-center">
              <span className="text-2xl font-black text-text-primary">{maxAccounts}</span>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">Account Slots</span>
            </div>
            <div className="bg-dark-900/50 p-4 rounded-2xl border border-white/5 flex flex-col items-center">
              <span className="text-2xl font-black text-text-primary">{remainingPosts}</span>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">Remaining</span>
            </div>
          </div>
        </div>

        {plan === 'free' || plan === 'starter' ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="mt-8 w-full p-4 rounded-2xl bg-gradient-to-tr from-primary to-secondary text-white font-black text-sm shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <ArrowUpCircleIcon className="w-5 h-5" />
            UPGRADE FOR UNLIMITED
          </motion.button>
        ) : (
          <div className="mt-8 flex items-center gap-3 p-4 bg-success/5 rounded-2xl border border-success/10 justify-center">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] font-black text-success uppercase tracking-widest">Premium Active</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default SubscriptionInfo;
