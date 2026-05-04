import { motion } from 'framer-motion';
import { PlatformIcon, type PlatformType } from '../ui';

interface PlatformDef {
  id: PlatformType;
  name: string;
  color: string; // hex used for glow + accent ring
}

const PLATFORMS: PlatformDef[] = [
  { id: 'facebook', name: 'Facebook', color: '#1877F2' },
  { id: 'instagram', name: 'Instagram', color: '#E4405F' },
  { id: 'tiktok', name: 'TikTok', color: '#FF0050' },
  { id: 'youtube', name: 'YouTube', color: '#FF0000' },
  { id: 'twitter', name: 'X', color: '#FFFFFF' },
  { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2' },
  { id: 'pinterest', name: 'Pinterest', color: '#E60023' },
  { id: 'threads', name: 'Threads', color: '#FFFFFF' },
];

export function PlatformStrip() {
  return (
    <section className="relative py-16 md:py-20 border-y border-white/[0.06] overflow-hidden">
      {/* Subtle ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-32 bg-coral/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 md:mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green" />
            </span>
            <span className="text-[11px] font-semibold text-text-secondary tracking-wide">
              8 platforms · 1 click
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold font-heading text-text-primary tracking-tight">
            Post once.{' '}
            <span className="bg-gradient-to-r from-coral to-purple bg-clip-text text-transparent">
              Reach everywhere.
            </span>
          </h2>
        </motion.div>

        {/* Platform grid */}
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3 md:gap-4">
          {PLATFORMS.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              whileHover={{ y: -4 }}
              className="group relative"
            >
              {/* Glow halo on hover */}
              <div
                className="absolute -inset-2 rounded-2xl opacity-0 group-hover:opacity-60 blur-xl transition-opacity duration-500"
                style={{ background: p.color }}
              />

              <div className="relative h-24 md:h-28 rounded-2xl bg-bg-card/80 backdrop-blur-sm border border-white/[0.06] flex flex-col items-center justify-center gap-2 transition-all duration-300 group-hover:border-white/[0.18] overflow-hidden">
                {/* Subtle brand-colored radial wash on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: `radial-gradient(circle at 50% 30%, ${p.color}30, transparent 70%)`,
                  }}
                />

                {/* Top corner shine */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Icon */}
                <div
                  className="relative w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                  style={{
                    color: p.color,
                    filter: 'drop-shadow(0 0 0 transparent)',
                  }}
                >
                  <PlatformIcon platform={p.id} size="xl" />
                </div>

                {/* Name */}
                <span className="relative text-[11px] md:text-xs font-semibold text-text-muted group-hover:text-text-primary transition-colors duration-300">
                  {p.name}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom callout */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-text-muted"
        >
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-coral" />
            Auto-resize per platform
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-purple" />
            Smart-time scheduling
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-amber" />
            One-click cross-post
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-green" />
            More platforms coming
          </span>
        </motion.div>
      </div>
    </section>
  );
}

export default PlatformStrip;
