import { useState, useEffect } from 'react';

interface FeedbackQuestion {
  id: string;
  emoji: string;
  question: string;
  options: string[];
  condition?: (answers: Record<string, string>) => boolean;
}

const FEEDBACK_QUESTIONS: FeedbackQuestion[] = [
  {
    id: 'what', emoji: '🤔',
    question: 'What would you like to change?',
    options: ['The caption / text', 'The image style', 'The overall topic', 'The tone of voice', 'Something else'],
  },
  {
    id: 'caption_fix', emoji: '✍️',
    question: 'What about the caption?',
    options: ['Too long — make it shorter', 'Too short — add more detail', 'Wrong tone — make it more professional', 'Wrong tone — make it more casual', 'Different angle / hook', 'Change the call-to-action'],
    condition: (a) => a.what === 'The caption / text',
  },
  {
    id: 'image_fix', emoji: '🎨',
    question: 'What about the image?',
    options: ['Different colors', 'More minimal / clean', 'More bold / eye-catching', 'Different layout', 'Change the text on the image', 'Completely different concept'],
    condition: (a) => a.what === 'The image style',
  },
  {
    id: 'tone_fix', emoji: '🗣️',
    question: 'What tone would you prefer?',
    options: ['More professional / formal', 'More friendly / approachable', 'More bold / provocative', 'More educational / helpful', 'More casual / fun'],
    condition: (a) => a.what === 'The tone of voice',
  },
  {
    id: 'topic_fix', emoji: '💡',
    question: 'What type of content instead?',
    options: ['Success story / case study', 'How-to / tutorial', 'Industry news / trends', 'Tips & tricks list', 'Behind the scenes', 'Myth-busting / contrarian'],
    condition: (a) => a.what === 'The overall topic',
  },
];

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: Record<string, string>) => void;
}

export function FeedbackModal({ isOpen, onClose, onSubmit }: FeedbackModalProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [customText, setCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAnswers({});
      setCurrentStep(0);
      setCustomText('');
      setShowCustomInput(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Find current question
  const question = currentStep === 0
    ? FEEDBACK_QUESTIONS[0]
    : FEEDBACK_QUESTIONS.find((q) => q.id !== 'what' && q.condition && q.condition(answers));

  const handleSelect = (option: string) => {
    if (!question) return;

    // "Something else" → show custom text input
    if (option === 'Something else') {
      setShowCustomInput(true);
      setAnswers({ ...answers, what: option });
      return;
    }

    const newAnswers = { ...answers, [question.id]: option };
    setAnswers(newAnswers);

    if (currentStep === 0) {
      const hasFollowUp = FEEDBACK_QUESTIONS.some(
        (q) => q.id !== 'what' && q.condition && q.condition(newAnswers)
      );
      if (hasFollowUp) {
        setTimeout(() => setCurrentStep(1), 300);
      } else {
        setTimeout(() => onSubmit(newAnswers), 300);
      }
    } else {
      setTimeout(() => onSubmit(newAnswers), 300);
    }
  };

  const handleCustomSubmit = () => {
    if (!customText.trim()) return;
    onSubmit({ ...answers, custom: customText.trim() });
  };

  if (!question && !showCustomInput) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] rounded-[20px] p-9 scale-in"
        style={{
          background: 'rgb(var(--c-bg-elevated))',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {showCustomInput ? (
          <>
            {/* Custom text input */}
            <div className="text-center mb-6">
              <div className="text-[40px] mb-3">💬</div>
              <h3 className="text-[22px] font-extrabold text-text-primary">Tell us what to change</h3>
              <p className="text-[14px] text-text-secondary mt-1">
                Describe what you'd like differently and we'll regenerate it.
              </p>
            </div>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="e.g. Make it more punchy, use different colors, focus on pricing..."
              rows={4}
              autoFocus
              className="w-full rounded-[14px] p-4 text-[14px] resize-none mb-4"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '2px solid var(--border-color)',
                color: 'rgb(var(--c-text-primary))',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(232,54,79,0.4)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customText.trim()}
              className="w-full py-3.5 rounded-[14px] text-[15px] font-bold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                boxShadow: 'var(--shadow-glow-coral)',
                opacity: !customText.trim() ? 0.4 : 1,
              }}
            >
              Regenerate with this feedback
            </button>
          </>
        ) : question ? (
          <>
            {/* Question */}
            <div className="text-center mb-6">
              <div className="text-[40px] mb-3">{question.emoji}</div>
              <h3 className="text-[22px] font-extrabold text-text-primary">{question.question}</h3>
              <p className="text-[14px] text-text-secondary mt-1">
                Pick one and we'll regenerate this post for you.
              </p>
            </div>

            {/* Options */}
            <div className="space-y-2">
              {question.options.map((option, i) => (
                <button
                  key={option}
                  onClick={() => handleSelect(option)}
                  className={`w-full text-left px-5 py-3.5 rounded-[14px] text-[14px] font-semibold transition-all duration-200 au${Math.min(i + 1, 5)}`}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '2px solid var(--border-color)',
                    color: 'rgb(var(--c-text-primary))',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(232,54,79,0.4)';
                    e.currentTarget.style.background = 'rgba(232,54,79,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {/* Cancel button */}
        <div className="text-center mt-5">
          <button
            onClick={onClose}
            className="text-[13px] font-medium text-text-muted hover:text-text-secondary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default FeedbackModal;
