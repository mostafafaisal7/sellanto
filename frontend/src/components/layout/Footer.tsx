import { Link } from 'react-router-dom';

interface FooterLink {
  label: string;
  href: string;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

const footerSections: FooterSection[] = [
  {
    title: 'Product',
    links: [
      { label: 'Dashboard', href: '/' },
      { label: 'Create Post', href: '/posts/create' },
      { label: 'Connect Accounts', href: '/platforms' },
      { label: 'Magic Mode', href: '/magic' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Help', href: '/help' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-16 bg-dark-800/80 border-t border-white/10 rounded-t-2xl">
      {/* Gradient separator */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      {/* Main footer content */}
      <div className="pt-10 pb-8 px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Branding */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-4 group">
              <div
                className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #E8364F, #FF6B6B)',
                  boxShadow: '0 2px 8px rgba(232,54,79,0.3)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M13 3L4 14h7l-1 7 9-11h-7l1-7z"
                    fill="white"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-lg font-extrabold gradient-text">Sellanto</span>
            </Link>
            <p className="text-sm text-text-muted leading-relaxed">
              AI-powered social media management. Create, schedule, and grow.
            </p>
          </div>

          {/* Link sections */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4
                className="uppercase tracking-wider mb-4"
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: 'rgb(var(--c-text-muted))',
                  letterSpacing: '1.2px',
                }}
              >
                {section.title}
              </h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/[0.06] py-6 px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-xs text-text-muted">
          &copy; {currentYear} Sellanto. All rights reserved.
        </span>

        <div className="flex items-center gap-3">
          <a
            href="https://twitter.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-icon p-1.5"
            aria-label="Twitter"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-icon p-1.5"
            aria-label="GitHub"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
