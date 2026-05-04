import { motion } from 'framer-motion';
import {
  PhotoIcon,
  CheckCircleIcon,
  PaintBrushIcon,
} from '@heroicons/react/24/outline';

const TILES = [
  { ratio: 'aspect-[4/5]', from: 'from-coral/50', to: 'to-amber/40', label: 'Hero shot' },
  { ratio: 'aspect-square', from: 'from-purple/50', to: 'to-coral/40', label: 'IG feed' },
  { ratio: 'aspect-[3/4]', from: 'from-amber/50', to: 'to-green/40', label: 'Carousel' },
  { ratio: 'aspect-square', from: 'from-blue/50', to: 'to-purple/40', label: 'Story' },
  { ratio: 'aspect-[4/5]', from: 'from-green/50', to: 'to-blue/40', label: 'Pinterest pin' },
  { ratio: 'aspect-square', from: 'from-coral/50', to: 'to-purple/40', label: 'Thumbnail' },
];

export function AIImageSection() {
  return (
    <section id="features" className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: image grid */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="order-2 lg:order-1 grid grid-cols-3 gap-3 md:gap-4"
          >
            {TILES.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className={`relative ${t.ratio} rounded-2xl overflow-hidden border border-white/[0.08] group cursor-pointer`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${t.from} ${t.to}`} />
                <div className="absolute inset-0 mix-blend-overlay opacity-40"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5), transparent 50%)',
                  }}
                />

                {/* Shimmer */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[length:200%_100%] animate-shimmer"
                  style={{
                    backgroundImage:
                      'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)',
                  }}
                />

                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-bg-primary/70 backdrop-blur-sm text-text-primary border border-white/10">
                    {t.label}
                  </span>
                  <PhotoIcon className="w-3.5 h-3.5 text-white/60" />
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Right: copy */}
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="order-1 lg:order-2"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple/10 border border-purple/20 mb-5">
              <PaintBrushIcon className="w-3.5 h-3.5 text-purple" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple">
                Powered by Gemini · ImageFX
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl font-extrabold font-heading text-text-primary tracking-tight leading-[1.1]">
              Stunning visuals,{' '}
              <span className="bg-gradient-to-r from-purple via-coral to-amber bg-clip-text text-transparent">
                no designer required
              </span>
            </h2>

            <p className="mt-5 text-lg text-text-secondary leading-relaxed">
              Sellanto generates feed-ready imagery for every platform — hero shots,
              carousels, stories, thumbnails — in your brand's exact look and feel.
            </p>

            <ul className="mt-7 space-y-3.5">
              {[
                'Trained on your existing brand assets and palette',
                'Auto-resized to every platform spec out of the box',
                'Regenerate variations with a single click',
                'Upload your own photos as references for consistency',
              ].map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <CheckCircleIcon className="w-5 h-5 text-purple mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-text-secondary leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default AIImageSection;
