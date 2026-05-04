import { useEffect, useState } from 'react';
import {
  LandingNavbar,
  HeroSection,
  PlatformStrip,
  MagicModeSection,
  AIVideoSection,
  AIImageSection,
  MultiPlatformSection,
  PricingSection,
  FinalCTASection,
  LandingFooter,
} from '../components/landing';
import { AuthModal, type AuthMode } from '../components/auth';

export function LandingPage() {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [seedEmail, setSeedEmail] = useState<string | undefined>();

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Sellanto — AI-powered social content engine';

    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute('content');
    const desc =
      "Turn any URL into a week of AI-generated social content. Magic Mode, Veo video, Gemini imagery, and 8-platform scheduling — built for creators and small teams.";
    if (meta) {
      meta.setAttribute('content', desc);
    } else {
      const m = document.createElement('meta');
      m.name = 'description';
      m.content = desc;
      document.head.appendChild(m);
    }

    return () => {
      document.title = prevTitle;
      if (meta && prevDesc !== null && prevDesc !== undefined) {
        meta.setAttribute('content', prevDesc);
      }
    };
  }, []);

  const openLogin = () => {
    setSeedEmail(undefined);
    setAuthMode('login');
  };
  const openSignup = (email?: string) => {
    setSeedEmail(email);
    setAuthMode('signup');
  };

  return (
    <div className="relative min-h-screen bg-bg-primary text-text-primary overflow-x-hidden">
      <LandingNavbar onSignIn={openLogin} onSignUp={() => openSignup()} />

      <main>
        <HeroSection
          onPrimary={() => openSignup()}
          onSecondary={() => {
            const el = document.getElementById('magic');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <PlatformStrip />
        <MagicModeSection onCta={() => openSignup()} />
        <AIVideoSection />
        <AIImageSection />
        <MultiPlatformSection />
        <PricingSection onSelect={() => openSignup()} />
        <FinalCTASection onSubmit={(email) => openSignup(email)} />
      </main>

      <LandingFooter />

      <AuthModal
        isOpen={authMode !== null}
        mode={authMode ?? 'login'}
        initialEmail={seedEmail}
        onClose={() => setAuthMode(null)}
        onModeChange={(m) => setAuthMode(m)}
      />
    </div>
  );
}

export default LandingPage;
