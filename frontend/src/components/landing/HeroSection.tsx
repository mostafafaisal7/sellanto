import { motion, type Variants } from 'framer-motion';
import {
  SparklesIcon,
  ArrowRightIcon,
  PlayCircleIcon,
  PhotoIcon,
  VideoCameraIcon,
  ChatBubbleBottomCenterTextIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../ui';

interface HeroSectionProps {
  onPrimary: () => void;
  onSecondary: () => void;
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.05 * i, duration: 0.6, ease: 'easeOut' as const },
  }),
};

export function HeroSection({ onPrimary, onSecondary }: HeroSectionProps) {
  return (
    <section
      id="top"
      className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden"
    >
      {/* Animated orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-[28rem] h-[28rem] rounded-full bg-coral/30 blur-[140px] animate-orb-float-1" />
        <div className="absolute bottom-0 right-0 w-[32rem] h-[32rem] rounded-full bg-purple/30 blur-[160px] animate-orb-float-2" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[20rem] h-[20rem] rounded-full bg-amber/20 blur-[120px]" />
      </div>

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage:
            'radial-gradient(ellipse at top, black 30%, transparent 70%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Eyebrow */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] backdrop-blur-sm mb-7"
        >
          <SparklesIcon className="w-4 h-4 text-coral" />
          <span className="text-xs font-semibold text-text-primary tracking-wide">
            AI-powered social content engine
          </span>
          <span className="text-[10px] font-bold text-coral bg-coral/10 px-1.5 py-0.5 rounded-md">
            v2.3
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={1}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold font-heading tracking-tight text-text-primary leading-[1.05]"
        >
          <span className="block">Turn any URL into</span>
          <span className="block mt-2 bg-gradient-to-r from-coral via-amber to-purple bg-clip-text text-transparent pb-2">
            a week of social content
          </span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={2}
          className="mt-6 max-w-2xl mx-auto text-base md:text-lg text-text-secondary leading-relaxed"
        >
          Sellanto's <span className="text-text-primary font-semibold">Magic Mode</span>{' '}
          takes a single link, asks 3 quick questions, and ships ready-to-post videos,
          images, and captions across 8 platforms — powered by{' '}
          <span className="text-text-primary font-semibold">Google Veo</span> &amp;{' '}
          <span className="text-text-primary font-semibold">Gemini</span>.
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={3}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Button
            size="lg"
            onClick={onPrimary}
            rightIcon={<ArrowRightIcon className="w-4 h-4" />}
          >
            Start free — no card needed
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={onSecondary}
            leftIcon={<PlayCircleIcon className="w-5 h-5" />}
          >
            Watch the 90-sec demo
          </Button>
        </motion.div>

        {/* Trust line */}
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={4}
          className="mt-6 text-xs text-text-muted"
        >
          Free forever for solo creators · Cancel anytime · No credit card
        </motion.p>

        {/* Hero mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.7, ease: 'easeOut' as const }}
          className="relative mt-16 md:mt-20 max-w-5xl mx-auto"
        >
          {/* Glow underlay */}
          <div className="absolute -inset-6 bg-gradient-to-r from-coral/30 via-purple/20 to-amber/30 blur-3xl opacity-60 rounded-[40px]" />

          <div className="relative rounded-3xl bg-bg-card/80 backdrop-blur-xl border border-white/[0.08] shadow-2xl overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-coral/70" />
                <span className="w-3 h-3 rounded-full bg-amber/70" />
                <span className="w-3 h-3 rounded-full bg-green/70" />
              </div>
              <div className="ml-3 px-3 py-1 rounded-md bg-white/[0.04] text-[11px] text-text-muted font-mono flex-1 max-w-md mx-auto text-center">
                app.sellanto.io / magic
              </div>
            </div>

            <div className="p-5 md:p-8 grid md:grid-cols-12 gap-5">
              {/* Left: URL prompt card */}
              <div className="md:col-span-5 space-y-4">
                <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4">
                  <div className="text-[11px] font-semibold uppercase text-coral tracking-widest">
                    Step 1
                  </div>
                  <p className="text-sm font-semibold text-text-primary mt-1">
                    Paste any URL
                  </p>
                  <div className="mt-3 px-3 py-2.5 rounded-lg bg-bg-primary/60 border border-white/[0.06] font-mono text-[12px] text-text-secondary truncate">
                    https://shop.sellanto.io/products/aurora
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4">
                  <div className="text-[11px] font-semibold uppercase text-purple tracking-widest">
                    Step 2
                  </div>
                  <p className="text-sm font-semibold text-text-primary mt-1">
                    Answer 3 quick questions
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {['Who is your audience?', 'What\'s your tone?', 'Goal of this drop?'].map(
                      (q) => (
                        <div
                          key={q}
                          className="text-[12px] text-text-secondary flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-coral" />
                          {q}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Right: result grid */}
              <div className="md:col-span-7 space-y-3">
                <div className="text-[11px] font-semibold uppercase text-amber tracking-widest">
                  Step 3 — AI ships your week
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: VideoCameraIcon, label: 'Veo cinematic', from: 'from-coral/40', to: 'to-purple/30' },
                    { icon: PhotoIcon, label: 'Gemini hero shot', from: 'from-amber/40', to: 'to-coral/30' },
                    { icon: ChatBubbleBottomCenterTextIcon, label: 'IG caption', from: 'from-purple/40', to: 'to-blue/30' },
                    { icon: SparklesIcon, label: 'Story carousel', from: 'from-green/40', to: 'to-amber/30' },
                  ].map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 + i * 0.08 }}
                      className="relative aspect-video rounded-xl border border-white/[0.06] overflow-hidden group"
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${item.from} ${item.to}`}
                      />
                      <div className="absolute inset-0 bg-bg-card/50 backdrop-blur-[2px]" />
                      <div className="relative h-full p-3 flex flex-col justify-between">
                        <item.icon className="w-5 h-5 text-text-primary" />
                        <div className="text-[12px] font-semibold text-text-primary">
                          {item.label}
                        </div>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  ))}
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 flex items-center justify-between">
                  <span className="text-[12px] text-text-secondary">
                    Ready to publish to <span className="text-text-primary font-semibold">8 platforms</span>
                  </span>
                  <span className="text-[11px] font-semibold text-green bg-green/10 px-2 py-1 rounded-md">
                    All clear ✓
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default HeroSection;
