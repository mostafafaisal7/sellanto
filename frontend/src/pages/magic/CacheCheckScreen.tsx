import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface CacheCheckScreenProps {
  onUseCache: () => void;
  onRegenerate: () => void;
  onNoCacheFound: () => void;
  cacheFound: boolean;
  loading: boolean;
}

export function CacheCheckScreen({
  onUseCache,
  onRegenerate,
  onNoCacheFound,
  cacheFound,
  loading,
}: CacheCheckScreenProps) {
  const [dots, setDots] = useState('');

  // Animate loading dots
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, [loading]);

  // Auto-proceed if no cache found
  useEffect(() => {
    if (!loading && !cacheFound) {
      const timer = setTimeout(() => {
        onNoCacheFound();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [loading, cacheFound, onNoCacheFound]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-10"
      style={{ background: 'rgb(var(--c-bg-primary))' }}
    >
      {loading ? (
        /* Loading state */
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="text-[56px] mb-6 animate-bounce">🔍</div>
          <h1 className="text-[32px] font-black text-text-primary text-center mb-3">
            Checking for previous data{dots}
          </h1>
          <p className="text-[16px] text-text-secondary text-center max-w-[520px] leading-relaxed">
            Looking for content we've already generated with these settings
          </p>

          {/* Loading spinner */}
          <div className="mt-8 flex justify-center">
            <div
              className="w-12 h-12 rounded-full border-4 animate-spin"
              style={{
                borderColor: 'rgba(232,54,79,0.2)',
                borderTopColor: 'rgb(var(--c-coral))',
              }}
            />
          </div>
        </motion.div>
      ) : cacheFound ? (
        /* Cache found - Show options */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center w-full max-w-[480px]"
        >
          <div className="text-[56px] mb-6">✨</div>
          <h1 className="text-[32px] font-black text-text-primary text-center mb-3">
            Found your previous posts!
          </h1>
          <p className="text-[16px] text-text-secondary text-center max-w-[520px] mb-8 leading-relaxed">
            We already created content with these exact settings. Would you like to use it or generate fresh content?
          </p>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={onUseCache}
              className="w-full py-4 rounded-[16px] text-[16px] font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                boxShadow: 'var(--shadow-glow-coral)',
              }}
            >
              ✓ Use Previous Data
            </button>
            <button
              onClick={onRegenerate}
              className="w-full py-4 rounded-[16px] text-[16px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
                color: 'rgb(var(--c-text-primary))',
              }}
            >
              🔄 Generate Fresh Content
            </button>
          </div>
        </motion.div>
      ) : (
        /* No cache - Transition message */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="text-[56px] mb-6">🚀</div>
          <h1 className="text-[28px] font-black text-text-primary text-center mb-3">
            Generating fresh content...
          </h1>
        </motion.div>
      )}
    </div>
  );
}

export default CacheCheckScreen;
