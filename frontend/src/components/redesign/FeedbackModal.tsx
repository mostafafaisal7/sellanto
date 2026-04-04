import { useState, useEffect } from 'react';

interface FeedbackOption {
  label: string;
  emoji: string;
  desc: string;
}

interface FeedbackStep {
  id: string;
  emoji: string;
  question: string;
  options: FeedbackOption[];
  condition?: (answers: Record<string, string>) => boolean;
}

const STEPS: FeedbackStep[] = [
  {
    id: 'what', emoji: '🤔',
    question: 'What would you like to change?',
    options: [
      { label: 'The caption / text', emoji: '✍️', desc: 'Rewrite or improve the caption' },
      { label: 'The image style', emoji: '🎨', desc: 'Change the visual design' },
      { label: 'The overall topic', emoji: '💡', desc: 'Switch to a different angle' },
      { label: 'The tone of voice', emoji: '🗣️', desc: 'Adjust how it sounds' },
      { label: 'Something else', emoji: '💬', desc: 'Describe it yourself' },
    ],
  },
  {
    id: 'caption_fix', emoji: '✍️',
    question: 'What about the caption?',
    options: [
      { label: 'Too long — make it shorter', emoji: '✂️', desc: 'Condense to key points' },
      { label: 'Too short — add more detail', emoji: '📝', desc: 'Expand with more context' },
      { label: 'More professional tone', emoji: '👔', desc: 'Formal and authoritative' },
      { label: 'More casual tone', emoji: '😎', desc: 'Relaxed and conversational' },
      { label: 'Different angle / hook', emoji: '🎯', desc: 'New opening or perspective' },
      { label: 'Change the call-to-action', emoji: '📢', desc: 'Different CTA at the end' },
    ],
    condition: (a) => a.what === 'The caption / text',
  },
  {
    id: 'image_fix', emoji: '🎨',
    question: 'What about the image?',
    options: [
      { label: 'Different colors', emoji: '🌈', desc: 'Change the color palette' },
      { label: 'More minimal / clean', emoji: '✨', desc: 'Simplify the design' },
      { label: 'More bold / eye-catching', emoji: '🔥', desc: 'Make it stand out in the feed' },
      { label: 'Different layout', emoji: '📐', desc: 'Rearrange elements' },
      { label: 'Change the text overlay', emoji: '🔤', desc: 'Different text on the image' },
      { label: 'Completely different concept', emoji: '🔄', desc: 'Start fresh with a new idea' },
    ],
    condition: (a) => a.what === 'The image style',
  },
  {
    id: 'tone_fix', emoji: '🗣️',
    question: 'What tone would you prefer?',
    options: [
      { label: 'More professional / formal', emoji: '👔', desc: 'Business-appropriate language' },
      { label: 'More friendly / approachable', emoji: '🤝', desc: 'Warm and inviting' },
      { label: 'More bold / provocative', emoji: '⚡', desc: 'Attention-grabbing and edgy' },
      { label: 'More educational / helpful', emoji: '📚', desc: 'Informative and valuable' },
      { label: 'More casual / fun', emoji: '🎉', desc: 'Light-hearted and playful' },
    ],
    condition: (a) => a.what === 'The tone of voice',
  },
  {
    id: 'topic_fix', emoji: '💡',
    question: 'What type of content instead?',
    options: [
      { label: 'Success story / case study', emoji: '🏆', desc: 'Real results and outcomes' },
      { label: 'How-to / tutorial', emoji: '📋', desc: 'Step-by-step guide' },
      { label: 'Industry news / trends', emoji: '📰', desc: 'What\'s happening now' },
      { label: 'Tips & tricks list', emoji: '💎', desc: 'Quick actionable advice' },
      { label: 'Behind the scenes', emoji: '🎬', desc: 'Show your process' },
      { label: 'Myth-busting / contrarian', emoji: '🧨', desc: 'Challenge common beliefs' },
    ],
    condition: (a) => a.what === 'The overall topic',
  },
];

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: Record<string, string>) => void;
  postTitle?: string;
  postPlatform?: string;
}

export function FeedbackModal({ isOpen, onClose, onSubmit, postTitle, postPlatform }: FeedbackModalProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [customText, setCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [extraNote, setExtraNote] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAnswers({});
      setCurrentStep(0);
      setCustomText('');
      setShowCustomInput(false);
      setExtraNote('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const step0 = STEPS[0];
  const followUp = currentStep === 1
    ? STEPS.find((s) => s.id !== 'what' && s.condition && s.condition(answers))
    : null;
  const currentQuestion = currentStep === 0 ? step0 : followUp;
  const totalSteps = currentStep === 0 ? (answers.what ? 2 : 1) : 2;

  const handleSelect = (option: string) => {
    if (!currentQuestion) return;

    if (option === 'Something else') {
      setShowCustomInput(true);
      setAnswers({ ...answers, what: option });
      return;
    }

    const newAnswers = { ...answers, [currentQuestion.id]: option };
    setAnswers(newAnswers);

    if (currentStep === 0) {
      const hasFollowUp = STEPS.some(
        (s) => s.id !== 'what' && s.condition && s.condition(newAnswers)
      );
      if (hasFollowUp) {
        setTimeout(() => setCurrentStep(1), 200);
      } else {
        setTimeout(() => onSubmit(newAnswers), 200);
      }
    } else {
      // Step 2 — submit with extra note if present
      const finalAnswers = extraNote.trim()
        ? { ...newAnswers, custom: extraNote.trim() }
        : newAnswers;
      setTimeout(() => onSubmit(finalAnswers), 200);
    }
  };

  const handleCustomSubmit = () => {
    if (!customText.trim()) return;
    onSubmit({ ...answers, custom: customText.trim() });
  };

  const handleBack = () => {
    setCurrentStep(0);
    setExtraNote('');
    const newAnswers = { ...answers };
    // Remove follow-up answers
    Object.keys(newAnswers).forEach((k) => { if (k !== 'what') delete newAnswers[k]; });
    setAnswers(newAnswers);
  };

  if (!currentQuestion && !showCustomInput) return null;

  const platformEmoji: Record<string, string> = {
    LinkedIn: '💼', Instagram: '📸', Facebook: '📘', Twitter: '🐦', TikTok: '🎵',
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[540px] rounded-[24px] overflow-hidden scale-in"
        style={{
          background: 'rgb(var(--c-bg-elevated))',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="h-[3px] w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: showCustomInput ? '100%' : `${((currentStep + 1) / totalSteps) * 100}%`,
              background: 'linear-gradient(90deg, rgb(var(--c-coral)), #FF6B6B)',
            }}
          />
        </div>

        <div className="p-8">
          {/* Post context header */}
          {postTitle && (
            <div
              className="flex items-center gap-3 p-3.5 rounded-[14px] mb-6"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div
                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[16px] flex-shrink-0"
                style={{ background: 'rgba(59,130,246,0.1)' }}
              >
                {platformEmoji[postPlatform || ''] || '📱'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-text-muted uppercase tracking-wide">Editing post</p>
                <p className="text-[14px] font-semibold text-text-primary truncate">{postTitle}</p>
              </div>
              {postPlatform && (
                <span
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0"
                  style={{ background: 'rgba(59,130,246,0.1)', color: 'rgb(var(--c-blue))' }}
                >
                  {postPlatform}
                </span>
              )}
            </div>
          )}

          {showCustomInput ? (
            <>
              {/* Custom text input */}
              <div className="text-center mb-5">
                <div className="text-[36px] mb-2">💬</div>
                <h3 className="text-[20px] font-extrabold text-text-primary">Tell us what to change</h3>
                <p className="text-[13px] text-text-secondary mt-1">
                  Describe what you'd like differently and we'll regenerate it.
                </p>
              </div>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="e.g. Make it more punchy, use different colors, focus on pricing..."
                rows={4}
                autoFocus
                className="w-full rounded-[14px] p-4 text-[14px] resize-none mb-4 focus:outline-none"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '2px solid var(--border-color)',
                  color: 'rgb(var(--c-text-primary))',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(232,54,79,0.4)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowCustomInput(false); setCustomText(''); }}
                  className="flex-1 py-3 rounded-[14px] text-[14px] font-semibold transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border-color)',
                    color: 'rgb(var(--c-text-secondary))',
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customText.trim()}
                  className="flex-[2] py-3 rounded-[14px] text-[14px] font-bold text-white transition-all"
                  style={{
                    background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                    boxShadow: 'var(--shadow-glow-coral)',
                    opacity: !customText.trim() ? 0.4 : 1,
                  }}
                >
                  Regenerate with this feedback
                </button>
              </div>
            </>
          ) : currentQuestion ? (
            <>
              {/* Step indicator + question */}
              <div className="text-center mb-5">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-[32px]">{currentQuestion.emoji}</span>
                </div>
                <h3 className="text-[20px] font-extrabold text-text-primary">{currentQuestion.question}</h3>
                <p className="text-[13px] text-text-secondary mt-1">
                  {currentStep === 0 ? 'Pick one and we\'ll ask a follow-up.' : 'Pick one and we\'ll regenerate this post.'}
                </p>
              </div>

              {/* Option cards */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                {currentQuestion.options.map((opt, i) => (
                  <button
                    key={opt.label}
                    onClick={() => handleSelect(opt.label)}
                    className={`text-left p-3.5 rounded-[14px] transition-all duration-200 group au${Math.min(i + 1, 5)}`}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1.5px solid rgba(255,255,255,0.08)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(232,54,79,0.4)';
                      e.currentTarget.style.background = 'rgba(232,54,79,0.06)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <span className="text-[20px] block mb-1.5">{opt.emoji}</span>
                    <p className="text-[13px] font-semibold text-text-primary leading-snug">{opt.label}</p>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-snug">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {/* Extra note input on step 2 */}
              {currentStep === 1 && (
                <div className="mb-3">
                  <input
                    type="text"
                    value={extraNote}
                    onChange={(e) => setExtraNote(e.target.value)}
                    placeholder="Any extra notes? (optional)"
                    className="w-full rounded-[12px] px-4 py-2.5 text-[13px] focus:outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1.5px solid rgba(255,255,255,0.08)',
                      color: 'rgb(var(--c-text-primary))',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(232,54,79,0.3)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                  />
                </div>
              )}

              {/* Back / Cancel */}
              <div className="flex items-center justify-center gap-4 mt-2">
                {currentStep === 1 && (
                  <button
                    onClick={handleBack}
                    className="text-[13px] font-semibold transition-colors"
                    style={{ color: 'rgb(var(--c-coral))' }}
                  >
                    ← Back
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="text-[13px] font-medium text-text-muted hover:text-text-secondary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default FeedbackModal;
