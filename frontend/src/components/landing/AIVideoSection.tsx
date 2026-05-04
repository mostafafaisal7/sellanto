import { motion } from 'framer-motion';
import {
  VideoCameraIcon,
  CheckCircleIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';

const BULLETS = [
  'Cinematic 1080p clips tuned to your brand voice',
  'Auto-fitted to Reels, Shorts, and TikTok ratios',
  'Built-in safety filters and on-brand color grading',
  'Save, regenerate, or hand off to a designer in one click',
];

export function AIVideoSection() {
  return (
    <section id="video" className="relative py-24 md:py-32 bg-bg-primary/40 border-y border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, x: -32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-coral/10 border border-coral/20 mb-5">
              <VideoCameraIcon className="w-3.5 h-3.5 text-coral" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
                Powered by Google Veo
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl font-extrabold font-heading text-text-primary tracking-tight leading-[1.1]">
              Cinematic AI video,{' '}
              <span className="bg-gradient-to-r from-coral to-purple bg-clip-text text-transparent">
                made for your brand
              </span>
            </h2>

            <p className="mt-5 text-lg text-text-secondary leading-relaxed">
              Generate scroll-stopping videos in seconds. No camera, no crew, no editor —
              just a prompt and Sellanto handles cinematography, motion, and platform-perfect
              cropping.
            </p>

            <ul className="mt-7 space-y-3.5">
              {BULLETS.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <CheckCircleIcon className="w-5 h-5 text-coral mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-text-secondary leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Right: video card mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 32 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            <div className="absolute -inset-6 bg-gradient-to-br from-coral/30 via-purple/20 to-amber/20 blur-3xl opacity-70 rounded-3xl" />

            <div className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-white/[0.08] bg-bg-card shadow-2xl">
              {/* Animated gradient as placeholder for video */}
              <div className="absolute inset-0">
                <div className="absolute inset-0 bg-gradient-to-br from-coral/40 via-purple/30 to-amber/30" />
                <motion.div
                  animate={{ x: ['-20%', '120%'] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'linear' as const }}
                  className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                />
                <div
                  className="absolute inset-0 opacity-30 mix-blend-overlay"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.6), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.4), transparent 40%)',
                  }}
                />
              </div>

              {/* Top label */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                <span className="px-2 py-1 rounded-md bg-bg-primary/70 backdrop-blur-sm text-[10px] font-bold text-coral border border-coral/20">
                  ● LIVE PREVIEW
                </span>
                <span className="px-2 py-1 rounded-md bg-bg-primary/70 backdrop-blur-sm text-[10px] font-mono text-text-secondary">
                  9:16 · 1080p
                </span>
              </div>

              {/* Center play */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-20 h-20 rounded-full bg-bg-primary/40 backdrop-blur-md border border-white/20 flex items-center justify-center"
                >
                  <PlayIcon className="w-9 h-9 text-white pl-1" />
                </motion.div>
              </div>

              {/* Bottom caption */}
              <div className="absolute bottom-0 inset-x-0 p-5 bg-gradient-to-t from-bg-primary/95 to-transparent">
                <div className="text-xs font-mono text-text-muted mb-1">
                  PROMPT
                </div>
                <p className="text-sm font-semibold text-text-primary leading-snug">
                  "A glowing aurora skincare bottle drifting through a dreamy
                  pastel-pink studio, soft cinematic light"
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default AIVideoSection;
