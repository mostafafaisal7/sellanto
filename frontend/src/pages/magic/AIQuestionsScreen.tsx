import { useState, useCallback } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface Question {
  id: string;
  emoji: string;
  question: string;
  subtext: string;
  options: string[];
  multi?: boolean;
}

const QUESTIONS: Question[] = [
  {
    id: 'industry', emoji: '🏢',
    question: "What best describes your business?",
    subtext: "This helps us pick the right content style",
    options: ['Digital Marketing Agency', 'E-commerce / Online Store', 'SaaS / Software Company', 'Local Service Business', 'Consulting / Freelancing', 'Other'],
  },
  {
    id: 'goal', emoji: '🎯',
    question: "What's your main goal with social media?",
    subtext: "We'll focus your content around this",
    options: ['Get more customers / leads', 'Build brand awareness', 'Drive website traffic', 'Establish thought leadership', 'Showcase products / services'],
  },
  {
    id: 'tone', emoji: '🗣️',
    question: 'How should your posts sound?',
    subtext: 'Pick the vibe that matches your brand',
    options: ['Professional & authoritative', 'Friendly & approachable', 'Bold & provocative', 'Educational & helpful', 'Fun & casual'],
  },
  {
    id: 'platforms', emoji: '📱',
    question: 'Where do you post most? (pick 1-2)',
    subtext: "We'll optimize content for these platforms",
    options: ['LinkedIn', 'Instagram', 'Facebook', 'Twitter / X', 'TikTok'],
    multi: true,
  },
  {
    id: 'colors', emoji: '🎨',
    question: 'What colors represent your brand?',
    subtext: "We'll use these in your image designs",
    options: ['Blue tones (trust, professional)', 'Red/Orange (energy, bold)', 'Green (growth, nature)', 'Purple (creative, premium)', 'Dark/Minimal (sleek, modern)', 'Use colors from my website'],
  },
];

interface AIQuestionsScreenProps {
  onComplete: (answers: Record<string, string | string[]>) => void;
  onBack: () => void;
}

export function AIQuestionsScreen({ onComplete, onBack }: AIQuestionsScreenProps) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [multiSel, setMultiSel] = useState<Set<string>>(new Set());
  const [animating, setAnimating] = useState(false);

  const question = QUESTIONS[currentQ];
  const progress = ((currentQ) / QUESTIONS.length) * 100;

  const goNext = useCallback(() => {
    if (animating) return;
    setAnimating(true);

    const nextQ = currentQ + 1;
    if (nextQ >= QUESTIONS.length) {
      onComplete(answers);
    } else {
      setTimeout(() => {
        setCurrentQ(nextQ);
        setMultiSel(new Set());
        setAnimating(false);
      }, 300);
    }
  }, [currentQ, answers, animating, onComplete]);

  const handleSelect = (option: string) => {
    if (animating) return;

    if (question.multi) {
      const next = new Set(multiSel);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      setMultiSel(next);
      setAnswers({ ...answers, [question.id]: Array.from(next) });
    } else {
      setAnswers({ ...answers, [question.id]: option });
      setTimeout(goNext, 400);
    }
  };

  const goBack = () => {
    if (currentQ === 0) {
      onBack();
    } else {
      setCurrentQ(currentQ - 1);
      setMultiSel(new Set());
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col p-10 pb-5"
      style={{ background: 'rgb(var(--c-bg-primary))' }}
    >
      {/* Progress bar */}
      <div className="w-full max-w-[560px] mx-auto mb-2">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[13px] font-semibold text-text-secondary">
            Question {currentQ + 1} of {QUESTIONS.length}
          </span>
          <span className="text-[13px] font-semibold" style={{ color: 'rgb(var(--c-coral))' }}>
            {Math.round(progress)}% done
          </span>
        </div>
        <div className="progress-bar-track" style={{ height: 6, borderRadius: 3 }}>
          <div
            className="progress-bar-fill"
            style={{ width: `${progress}%`, borderRadius: 3 }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-[560px] mx-auto w-full" key={currentQ}>
        <div className="text-[48px] mb-4 slide-up">{question.emoji}</div>
        <h2
          className="text-[28px] font-extrabold text-text-primary text-center mb-2 slide-up"
          style={{ letterSpacing: '-0.3px' }}
        >
          {question.question}
        </h2>
        <p className="text-[15px] text-text-secondary text-center mb-7 slide-up">
          {question.subtext}
        </p>

        {/* Options */}
        <div className="w-full max-w-[440px] mx-auto flex flex-col gap-3">
          {question.options.map((option, i) => {
            const isSelected = question.multi
              ? multiSel.has(option)
              : answers[question.id] === option;

            return (
              <button
                key={option}
                onClick={() => handleSelect(option)}
                className={`w-full text-left flex items-center gap-3.5 transition-all duration-200 au${Math.min(i + 1, 5)}`}
                style={{
                  padding: '16px 22px',
                  borderRadius: 16,
                  border: `2px solid ${isSelected ? 'rgba(232,54,79,0.4)' : 'var(--border-color)'}`,
                  background: isSelected ? 'rgba(232,54,79,0.1)' : 'rgba(255,255,255,0.03)',
                }}
              >
                {/* Checkbox */}
                <div
                  className="w-6 h-6 flex-shrink-0 flex items-center justify-center transition-all duration-200"
                  style={{
                    borderRadius: question.multi ? 7 : 12,
                    border: `2px solid ${isSelected ? 'rgb(var(--c-coral))' : 'rgba(255,255,255,0.15)'}`,
                    background: isSelected ? 'rgb(var(--c-coral))' : 'transparent',
                  }}
                >
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span
                  className="text-[15px] font-semibold transition-colors duration-200"
                  style={{ color: isSelected ? 'rgb(var(--c-coral))' : 'rgb(var(--c-text-primary))' }}
                >
                  {option}
                </span>
              </button>
            );
          })}
        </div>

        {/* Continue button for multi-select */}
        {question.multi && multiSel.size > 0 && (
          <div className="mt-8">
            <button
              onClick={goNext}
              className="px-6 py-3 rounded-[14px] text-[15px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                boxShadow: 'var(--shadow-glow-coral)',
              }}
            >
              Continue →
            </button>
          </div>
        )}
      </div>

      {/* Back button at bottom */}
      <div className="w-full max-w-[560px] mx-auto pt-4">
        <button onClick={goBack} className="btn-ghost flex items-center gap-1.5">
          <ArrowLeftIcon className="w-4 h-4" /> Back
        </button>
      </div>
    </div>
  );
}

export default AIQuestionsScreen;
