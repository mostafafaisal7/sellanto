import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SparklesIcon } from '@heroicons/react/24/solid';
import { format } from 'date-fns';

interface WelcomeSectionProps {
  username: string;
}

export function WelcomeSection({ username }: WelcomeSectionProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative p-8 rounded-2xl bg-gradient-to-br from-dark-700/80 to-dark-800/80 border border-white/5 mb-6 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
    >
      {/* Animated shimmer background */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent bg-[length:200%_100%] animate-shimmer" />

      {/* Animated gradient top border */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-secondary bg-[length:200%_100%] animate-gradient-shift rounded-t-2xl" />

      {/* Decorative glow */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Left: Welcome message */}
        <div className="flex items-center gap-5">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[0_10px_30px_rgb(var(--c-primary)_/_0.4)]"
          >
            <SparklesIcon className="w-7 h-7 text-white" />
          </motion.div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              <span className="text-text-primary">{getGreeting()}, </span>
              <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">{username}</span>
            </h1>
            <p className="text-text-secondary mt-1 font-medium">
              Welcome back! Here's what's happening with your social media.
            </p>
          </div>
        </div>

        {/* Right: Time display */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-5 py-3 bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/15 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgb(var(--c-primary)_/_0.2)]">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse-dot" />
            <div className="text-right">
              <p className="text-xl font-bold text-text-primary">
                {format(currentTime, 'HH:mm')}
              </p>
              <p className="text-sm text-text-muted">
                {format(currentTime, 'EEEE, MMMM d')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default WelcomeSection;
