import { motion } from 'framer-motion';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SCHEDULE = [
  { day: 0, slot: 0, label: 'Fb', color: 'bg-blue/30 border-blue/50' },
  { day: 0, slot: 2, label: 'Ig', color: 'bg-coral/30 border-coral/50' },
  { day: 1, slot: 1, label: 'TT', color: 'bg-purple/30 border-purple/50' },
  { day: 2, slot: 0, label: 'Yt', color: 'bg-coral/30 border-coral/50' },
  { day: 2, slot: 2, label: 'X', color: 'bg-text-muted/20 border-white/20' },
  { day: 3, slot: 1, label: 'In', color: 'bg-blue/30 border-blue/50' },
  { day: 4, slot: 0, label: 'Pin', color: 'bg-amber/30 border-amber/50' },
  { day: 4, slot: 2, label: 'Th', color: 'bg-green/30 border-green/50' },
  { day: 5, slot: 1, label: 'Ig', color: 'bg-coral/30 border-coral/50' },
  { day: 6, slot: 0, label: 'Fb', color: 'bg-blue/30 border-blue/50' },
];

export function MultiPlatformSection() {
  return (
    <section className="relative py-24 md:py-32 bg-bg-primary/40 border-y border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, x: -32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber/10 border border-amber/20 mb-5">
              <GlobeAltIcon className="w-3.5 h-3.5 text-amber" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber">
                Multi-platform · Scheduled
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl font-extrabold font-heading text-text-primary tracking-tight leading-[1.1]">
              Schedule once.{' '}
              <span className="bg-gradient-to-r from-amber via-coral to-purple bg-clip-text text-transparent">
                Sellanto handles the rest.
              </span>
            </h2>

            <p className="mt-5 text-lg text-text-secondary leading-relaxed">
              Lay out a week of content across all 8 platforms in a single calendar.
              Drag, drop, regenerate — Sellanto auto-publishes at the perfect time for
              every channel.
            </p>

            <ul className="mt-7 space-y-3.5">
              {[
                'Cross-post to Facebook, Instagram, TikTok, YouTube, X, LinkedIn, Pinterest, Threads',
                'Smart-schedule based on each platform\'s peak engagement windows',
                'Approval workflows for teams and clients',
                'Drafts, queues, and overflow buckets — never miss a post',
              ].map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <CheckCircleIcon className="w-5 h-5 text-amber mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-text-secondary leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Right: calendar mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 32 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            <div className="absolute -inset-6 bg-gradient-to-br from-amber/30 via-coral/20 to-purple/20 blur-3xl opacity-70 rounded-3xl" />

            <div className="relative rounded-3xl bg-bg-card border border-white/[0.08] shadow-2xl p-5 md:p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <CalendarDaysIcon className="w-5 h-5 text-amber" />
                  <span className="font-bold font-heading text-text-primary">
                    This week
                  </span>
                </div>
                <span className="text-[11px] font-mono text-text-muted">
                  10 posts · 8 platforms
                </span>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1.5 md:gap-2 mb-2">
                {DAYS.map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] md:text-[11px] font-semibold uppercase tracking-wider text-text-muted py-1"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1.5 md:gap-2">
                {DAYS.map((_, dayIdx) => (
                  <div
                    key={dayIdx}
                    className="relative h-32 md:h-40 rounded-xl bg-white/[0.03] border border-white/[0.05] p-1.5 flex flex-col gap-1"
                  >
                    {[0, 1, 2].map((slot) => {
                      const item = SCHEDULE.find(
                        (s) => s.day === dayIdx && s.slot === slot
                      );
                      if (!item) return <div key={slot} className="h-7 md:h-9" />;
                      return (
                        <motion.div
                          key={slot}
                          initial={{ opacity: 0, y: 8 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.1 + slot * 0.05 + dayIdx * 0.04 }}
                          className={`h-7 md:h-9 rounded-md border ${item.color} flex items-center justify-center text-[10px] md:text-[11px] font-bold text-text-primary`}
                        >
                          {item.label}
                        </motion.div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Footer status */}
              <div className="mt-4 flex items-center justify-between text-[11px]">
                <span className="text-text-muted">
                  Auto-publish: <span className="text-green font-semibold">on</span>
                </span>
                <span className="text-text-muted">
                  Next post in <span className="text-text-primary font-semibold">2h 14m</span>
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default MultiPlatformSection;
