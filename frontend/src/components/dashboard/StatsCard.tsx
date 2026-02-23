import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
  progress?: {
    current: number;
    max: number;
  };
  delay?: number;
}

export function StatsCard({ title, value, icon, trend, progress, delay = 0 }: StatsCardProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);

  useEffect(() => {
    // Animate number
    const duration = 1000;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setAnimatedValue(Math.floor(progress * value));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    const timeout = setTimeout(animate, delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  useEffect(() => {
    // Animate progress bar
    if (progress) {
      const timeout = setTimeout(() => {
        setProgressWidth((progress.current / progress.max) * 100);
      }, delay + 300);
      return () => clearTimeout(timeout);
    }
  }, [progress, delay]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.5 }}
      whileHover={{ y: -12 }}
      className="relative p-6 rounded-2xl bg-gradient-to-br from-dark-700/80 to-dark-800/80 border border-white/5 overflow-hidden transition-all duration-500 group shadow-[0_10px_40px_rgba(0,0,0,0.3)] hover:border-primary/20 hover:shadow-[0_25px_60px_rgb(var(--c-primary)_/_0.25)]"
    >
      {/* Hover glow effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgb(var(--c-primary)_/_0.1),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-6">
          <motion.div
            whileHover={{ rotate: -10, scale: 1.1 }}
            transition={{ duration: 0.4 }}
            className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[0_10px_30px_rgb(var(--c-primary)_/_0.3)] relative"
          >
            {/* Gradient border effect */}
            <div className="absolute inset-0 rounded-xl p-[2px] bg-gradient-to-br from-primary to-secondary opacity-50" style={{ WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' }} />
            <span className="text-white">{icon}</span>
          </motion.div>
          {trend && (
            <motion.div
              whileHover={{ scale: 1.05 }}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-300',
                trend.isPositive
                  ? 'bg-success/10 border-success/20 text-success hover:bg-success/15'
                  : 'bg-danger/10 border-danger/20 text-danger hover:bg-danger/15'
              )}
            >
              {trend.isPositive ? (
                <ArrowTrendingUpIcon className="w-3.5 h-3.5" />
              ) : (
                <ArrowTrendingDownIcon className="w-3.5 h-3.5" />
              )}
              {trend.value}%
            </motion.div>
          )}
        </div>

        <div className="mb-2">
          <span className="text-4xl font-black text-text-primary tracking-tight">{animatedValue}</span>
        </div>

        <p className="text-sm text-text-muted uppercase tracking-widest font-semibold">{title}</p>

        {progress && (
          <div className="mt-5">
            <div className="flex justify-between text-xs text-text-muted mb-2 font-medium">
              <span>{progress.current} used</span>
              <span>{progress.max} total</span>
            </div>
            <div className="h-2 bg-dark-900/50 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-secondary rounded-full shadow-[0_0_10px_rgb(var(--c-primary)_/_0.5)]"
                initial={{ width: 0 }}
                animate={{ width: `${progressWidth}%` }}
                transition={{ duration: 0.8, delay: delay / 1000 + 0.3 }}
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default StatsCard;
