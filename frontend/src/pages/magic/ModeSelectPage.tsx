import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

const magicChecks = [
  'Paste website → AI learns your brand',
  'Answer 5 quick questions',
  'Get 2 ready-to-publish posts',
  'Approve, edit, or ask for changes',
];

const manualChecks = [
  'Configure each step yourself',
  'Fine-tune AI at every stage',
  'Best for agencies & power users',
  '6-step guided workflow',
];

export function ModeSelectPage() {
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState<'magic' | 'manual' | null>(null);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-10 relative overflow-hidden"
      style={{ background: 'rgb(var(--c-bg-primary))' }}
    >
      {/* Floating orbs */}
      <div
        className="absolute animate-orb1 rounded-full opacity-20 blur-[80px]"
        style={{
          width: 300, height: 300, top: '10%', left: '10%',
          background: 'radial-gradient(circle, rgba(232,54,79,0.4), transparent)',
        }}
      />
      <div
        className="absolute animate-orb2 rounded-full opacity-15 blur-[80px]"
        style={{
          width: 250, height: 250, bottom: '5%', right: '10%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.4), transparent)',
        }}
      />

      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 au">
        <div
          className="w-11 h-11 rounded-[14px] flex items-center justify-center text-white font-black text-[22px]"
          style={{ background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))' }}
        >
          S
        </div>
        <span className="text-[26px] font-black text-text-primary tracking-[-0.5px]">Sellanto</span>
      </div>

      {/* Title */}
      <h1 className="text-[36px] font-black text-text-primary text-center leading-[1.2] mb-3 tracking-[-0.5px] au1">
        How would you like to get started?
      </h1>
      <p className="text-[17px] text-text-secondary text-center mb-10 au2">
        Pick your style. You can always switch later.
      </p>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[640px] w-full">
        {/* Magic Mode */}
        <button
          onClick={() => navigate('/magic')}
          onMouseEnter={() => setHoveredCard('magic')}
          onMouseLeave={() => setHoveredCard(null)}
          className="text-left p-8 rounded-[20px] transition-all duration-200 hover:-translate-y-1 au3"
          style={{
            background: 'linear-gradient(135deg, rgba(232,54,79,0.06), rgb(var(--c-bg-card)))',
            border: '1px solid rgba(232,54,79,0.3)',
            boxShadow: hoveredCard === 'magic' ? '0 8px 30px rgba(232,54,79,0.15)' : undefined,
          }}
        >
          <div className="text-[52px] mb-3 animate-float">✨</div>
          <span
            className="inline-block text-[11px] font-extrabold tracking-[1.5px] uppercase mb-2"
            style={{ color: 'rgb(var(--c-coral))' }}
          >
            RECOMMENDED
          </span>
          <h2 className="text-[22px] font-extrabold text-text-primary mb-2">Magic Mode</h2>
          <p className="text-[14px] text-text-secondary mb-5 leading-relaxed">
            Just paste your website. Answer a few quick questions. AI creates everything — ready to publish in minutes.
          </p>
          <div className="flex flex-col gap-1.5 mb-6">
            {magicChecks.map((text) => (
              <div key={text} className="flex items-start gap-2">
                <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'rgb(var(--c-green))' }} />
                <span className="text-[13px] text-text-secondary">{text}</span>
              </div>
            ))}
          </div>
          <span
            className="inline-flex items-center gap-2 px-6 py-3 rounded-[14px] text-[15px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
              boxShadow: 'var(--shadow-glow-coral)',
            }}
          >
            Start Magic Mode <ArrowRightIcon className="w-4 h-4" />
          </span>
        </button>

        {/* Manual */}
        <button
          onClick={() => navigate('/getting-started')}
          onMouseEnter={() => setHoveredCard('manual')}
          onMouseLeave={() => setHoveredCard(null)}
          className="text-left p-8 rounded-[20px] transition-all duration-200 hover:-translate-y-1 au4"
          style={{
            background: 'rgb(var(--c-bg-card))',
            border: '1px solid var(--border-color)',
            boxShadow: hoveredCard === 'manual' ? '0 8px 30px rgba(0,0,0,0.25)' : undefined,
          }}
        >
          <div className="text-[52px] mb-3">🛠️</div>
          <span className="inline-block text-[11px] font-extrabold tracking-[1.5px] uppercase text-text-muted mb-2">
            ADVANCED
          </span>
          <h2 className="text-[22px] font-extrabold text-text-primary mb-2">Manual Setup</h2>
          <p className="text-[14px] text-text-secondary mb-5 leading-relaxed">
            Full control over every step — brand profile, content pillars, topics, ideas, captions, images, scheduling.
          </p>
          <div className="flex flex-col gap-1.5 mb-6">
            {manualChecks.map((text) => (
              <div key={text} className="flex items-start gap-2">
                <ArrowRightIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-text-muted" />
                <span className="text-[13px] text-text-secondary">{text}</span>
              </div>
            ))}
          </div>
          <span
            className="inline-flex items-center gap-2 px-6 py-3 rounded-[14px] text-[15px] font-bold"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color)',
              color: 'rgb(var(--c-text-primary))',
            }}
          >
            Open Manual Setup
          </span>
        </button>
      </div>
    </div>
  );
}

export default ModeSelectPage;
