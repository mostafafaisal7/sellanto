import { SparklesIcon } from '@heroicons/react/24/outline';

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Magic Mode', href: '#magic' },
      { label: 'AI Video', href: '#video' },
      { label: 'AI Image', href: '#features' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Help Center', href: '/help' },
      { label: 'Contact', href: 'mailto:hello@sellanto.io' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
  {
    title: 'For developers',
    links: [
      { label: 'Status', href: '#' },
      { label: 'Changelog', href: '#' },
      { label: 'API (soon)', href: '#' },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="relative border-t border-white/[0.06] bg-bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-12 gap-10">
          {/* Brand block */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-primary shadow-glow-coral flex items-center justify-center">
                <SparklesIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold font-heading tracking-tight text-text-primary">
                Sellanto
              </span>
            </div>
            <p className="mt-4 text-sm text-text-secondary leading-relaxed max-w-sm">
              The AI-powered social content engine. Turn any URL into a week of
              cross-platform content — videos, images, captions — in minutes.
            </p>
            <p className="mt-6 text-xs text-text-muted">
              Built with Google Veo &amp; Gemini · Made for creators &amp; small teams.
            </p>
          </div>

          {/* Link columns */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-text-primary">
                  {col.title}
                </h4>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-text-muted">
            © {new Date().getFullYear()} Sellanto. All rights reserved.
          </p>
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span>v2.3</span>
            <span>·</span>
            <a href="/privacy" className="hover:text-text-primary transition-colors">
              Privacy
            </a>
            <span>·</span>
            <a href="/terms" className="hover:text-text-primary transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default LandingFooter;
