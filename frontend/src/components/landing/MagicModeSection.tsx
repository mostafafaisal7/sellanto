import { motion } from 'framer-motion';
import {
  LinkIcon,
  QuestionMarkCircleIcon,
  RocketLaunchIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../ui';

interface MagicModeSectionProps {
  onCta: () => void;
}

const STEPS = [
  {
    icon: LinkIcon,
    title: 'Drop a URL',
    body: 'Product page, blog post, landing — anything with a story. Sellanto reads it in seconds.',
    color: 'from-coral/40 to-amber/30',
  },
  {
    icon: QuestionMarkCircleIcon,
    title: 'Answer 3 questions',
    body: 'Audience, tone, goal. That\'s it. Magic Mode tunes itself to your brand voice.',
    color: 'from-purple/40 to-blue/30',
  },
  {
    icon: RocketLaunchIcon,
    title: 'Ship a full week',
    body: 'AI video, hero images, captions, hashtags — perfectly sized for every platform.',
    color: 'from-amber/40 to-coral/30',
  },
];

export function MagicModeSection({ onCta }: MagicModeSectionProps) {
  return (
    <section
      id="magic"
      className="relative py-24 md:py-32"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/3 w-[40rem] h-[40rem] rounded-full bg-coral/10 blur-[160px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-coral">
            Signature feature
          </span>
          <h2 className="mt-3 text-4xl md:text-5xl font-extrabold font-heading text-text-primary tracking-tight">
            Magic Mode — your URL is enough
          </h2>
          <p className="mt-5 text-lg text-text-secondary leading-relaxed">
            Skip the blank page forever. Sellanto's content engine turns any link into a
            polished, on-brand week of social posts in under two minutes.
          </p>
        </motion.div>

        {/* 3-step cards */}
        <div className="grid md:grid-cols-3 gap-5 md:gap-6">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="relative group"
            >
              {/* Step number */}
              <div className="absolute -top-3 -left-3 z-10 w-9 h-9 rounded-xl bg-gradient-primary shadow-glow-coral flex items-center justify-center text-sm font-bold text-white font-mono">
                0{i + 1}
              </div>

              <div className="relative h-full rounded-2xl bg-bg-card border border-white/[0.06] p-7 transition-all hover:border-white/[0.12] hover:-translate-y-1">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-5`}
                >
                  <step.icon className="w-6 h-6 text-text-primary" />
                </div>
                <h3 className="text-xl font-bold font-heading text-text-primary mb-2.5">
                  {step.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">{step.body}</p>
              </div>

              {/* Arrow connector */}
              {i < STEPS.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-3 z-10 -translate-y-1/2 w-6 h-6 rounded-full bg-bg-elevated border border-white/[0.08] items-center justify-center">
                  <ArrowRightIcon className="w-3 h-3 text-text-muted" />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 flex justify-center"
        >
          <Button
            size="lg"
            onClick={onCta}
            rightIcon={<ArrowRightIcon className="w-4 h-4" />}
          >
            Try Magic Mode free
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

export default MagicModeSection;
