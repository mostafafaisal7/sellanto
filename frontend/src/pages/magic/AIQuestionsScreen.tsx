import { useState, useCallback } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useMagicModeStore } from '../../store/magicModeStore';

interface Question {
  id: string;
  emoji: string;
  question: string;
  subtext: string;
  options: string[];
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
    options: ['Professional & Authoritative', 'Friendly & Approachable', 'Bold & Provocative', 'Educational & Helpful', 'Fun & Casual'],
  },
  {
    id: 'product_mode', emoji: '📦',
    question: 'Do you want to feature your real products in posts?',
    subtext: "Upload product images and we'll create posts featuring them",
    options: ['Yes - I have product images', 'No - AI generates everything'],
  },
  {
    id: 'platforms', emoji: '📱',
    question: 'Where do you post most? (pick 1-2)',
    subtext: "We'll optimize content for these platforms",
    options: ['LinkedIn', 'Instagram', 'Facebook', 'Twitter / X', 'TikTok'],
  },
  {
    id: 'colors', emoji: '🎨',
    question: 'What colors represent your brand?',
    subtext: "We'll use these in your image designs",
    options: ['Blue tones (trust, professional)', 'Red/Orange (energy, bold)', 'Green (growth, nature)', 'Purple (creative, premium)', 'Dark/Minimal (sleek, modern)', 'Use colors from my website'],
  },
];

/** Build a Set from a stored answer value (string or string[]). */
function answerToSet(val: string | string[] | undefined): Set<string> {
  if (!val) return new Set();
  return new Set(Array.isArray(val) ? val : [val]);
}

interface AIQuestionsScreenProps {
  onComplete: (answers: Record<string, string | string[]>) => void;
  onNext?: () => void;
  onBack: () => void;
  onProductUpload?: () => void; // NEW: Navigate to product upload screen
  skipIndustry?: boolean;
  startAtQuestion?: number; // NEW: Start from specific question index (for product upload flow)
}

export function AIQuestionsScreen({ onComplete, onNext, onBack, onProductUpload, skipIndustry, startAtQuestion }: AIQuestionsScreenProps) {
  const filteredQuestions = skipIndustry
    ? QUESTIONS.filter((q) => q.id !== 'industry')
    : QUESTIONS;

  const storeAnswers = useMagicModeStore((s) => s.answers);
  const setAnswer = useMagicModeStore((s) => s.setAnswer); // NEW: Access setAnswer from store
  const hasPreviousGeneration = useMagicModeStore((s) => s.hasPreviousGeneration);
  const setHasPreviousGeneration = useMagicModeStore((s) => s.setHasPreviousGeneration);
  const originalAnswers = useMagicModeStore((s) => s.originalAnswers);
  const originalCustomAnswers = useMagicModeStore((s) => s.originalCustomAnswers);
  const answersChanged = useMagicModeStore((s) => s.answersChanged);
  const markAnswersChanged = useMagicModeStore((s) => s.markAnswersChanged);
  const setCustomAnswer = useMagicModeStore((s) => s.setCustomAnswer);
  const storeCustomAnswers = useMagicModeStore((s) => s.customAnswers);

  // Start from specified question or default to 0
  const [currentQ, setCurrentQ] = useState(startAtQuestion || 0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(storeAnswers);
  // Initialize multiSel from the starting question's answer
  const [multiSel, setMultiSel] = useState<Set<string>>(() =>
    answerToSet(storeAnswers[filteredQuestions[startAtQuestion || 0]?.id])
  );
  const [animating, setAnimating] = useState(false);

  // 🔧 FIX: Initialize otherInputs from store's customAnswers
  // Convert "industry_other" → { industry: "..." }
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>(() => {
    const inputs: Record<string, string> = {};
    Object.entries(storeCustomAnswers || {}).forEach(([key, value]) => {
      // Extract question ID from "industry_other" format
      const match = key.match(/^(.+)_other$/);
      if (match) {
        inputs[match[1]] = value;
      }
    });
    return inputs;
  });

  const question = filteredQuestions[currentQ];
  const progress = ((currentQ) / filteredQuestions.length) * 100;

  const goNext = useCallback(() => {
    if (animating) return;
    setAnimating(true);

    // Check if current question is product_mode and user selected "Yes"
    const currentQuestion = filteredQuestions[currentQ];
    if (currentQuestion.id === 'product_mode' && onProductUpload) {
      const selectedProductMode = Array.from(multiSel)[0]; // Get first selection
      if (selectedProductMode === 'Yes - I have product images') {
        // ✅ FIX: Save answer to GLOBAL store (not just local state)
        const updatedAnswers = { ...answers, [currentQuestion.id]: Array.from(multiSel) };
        setAnswers(updatedAnswers);

        // Save ALL current answers to store before navigation
        Object.entries(updatedAnswers).forEach(([key, val]) => setAnswer(key, val));

        onProductUpload();
        setAnimating(false);
        return;
      }
    }

    const nextQ = currentQ + 1;
    if (nextQ >= filteredQuestions.length) {
      onComplete(answers);
    } else {
      setTimeout(() => {
        setCurrentQ(nextQ);
        // Restore previous selections for the next question
        const nextId = filteredQuestions[nextQ].id;
        setMultiSel(answerToSet(answers[nextId]));
        setAnimating(false);
      }, 300);
    }
  }, [currentQ, answers, animating, onComplete, filteredQuestions, multiSel, onProductUpload, setAnswer]);

  const handleSelect = (option: string) => {
    if (animating) return;

    const qId = question.id;
    const next = new Set(multiSel);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    setMultiSel(next);

    const newValue = Array.from(next);
    setAnswers({ ...answers, [qId]: newValue });

    // 🔍 CRITICAL FIX: Detect if this answer differs from original
    // Always run change detection (not just when originalAnswers exists)
    if (!answersChanged) {
      // Get original value (empty set if no original)
      const original = originalAnswers[qId];
      const originalSet = original
        ? new Set(Array.isArray(original) ? original : [original])
        : new Set();

      // Check if the sets are different
      const hasChanged = next.size !== originalSet.size ||
        [...next].some(v => !originalSet.has(v));

      if (hasChanged) {
        markAnswersChanged();
      }
    }
  };

  const goBack = () => {
    if (currentQ === 0) {
      onBack();
    } else {
      const prevQ = currentQ - 1;
      setCurrentQ(prevQ);
      // Restore previous selections for the question we're going back to
      const prevId = filteredQuestions[prevQ].id;
      setMultiSel(answerToSet(answers[prevId]));
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
            Question {currentQ + 1} of {filteredQuestions.length}
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
            const isSelected = multiSel.has(option);
            const isOtherOption = option === 'Other';

            return (
              <div key={option} className="w-full">
                <button
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
                      borderRadius: 7,
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

                {/* NEW: Dynamic text field for "Other" option */}
                {isOtherOption && isSelected && (
                  <div className="mt-3 slide-up">
                    <input
                      type="text"
                      value={otherInputs[question.id] || ''}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setOtherInputs({ ...otherInputs, [question.id]: newValue });
                        // Save to store immediately
                        setCustomAnswer(`${question.id}_other`, newValue);

                        // 🔍 CRITICAL FIX: Detect if custom "Other" text changed from original
                        if (!answersChanged && originalCustomAnswers[`${question.id}_other`] !== undefined) {
                          const originalValue = originalCustomAnswers[`${question.id}_other`];
                          if (newValue !== originalValue) {
                            markAnswersChanged();
                          }
                        }
                      }}
                      placeholder={
                        question.id === 'industry'
                          ? "Please specify your business type (e.g., 'Legal Services', 'Real Estate Agency')"
                          : question.id === 'goal'
                          ? "Please specify your goal..."
                          : question.id === 'tone'
                          ? "Describe your preferred tone..."
                          : "Please specify..."
                      }
                      className="w-full text-[15px]"
                      style={{
                        padding: '14px 18px',
                        borderRadius: 12,
                        border: '2px solid rgba(232,54,79,0.3)',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'rgb(var(--c-text-primary))',
                      }}
                      autoFocus
                    />
                    <p className="text-xs text-text-muted mt-2">
                      💡 Be specific to get the best AI-generated content for your {question.id}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Next button(s) — show based on question position and selection state */}
        {/* For last question: Always show buttons (even if no selection) to allow partial generation */}
        {/* For other questions: Require at least one selection AND Other text filled (if Other selected) */}
        {((currentQ === filteredQuestions.length - 1) ||
          (multiSel.size > 0 && !(multiSel.has('Other') && (!otherInputs[question.id] || !otherInputs[question.id].trim())))) && (
          <div className="mt-8">
            {/* Last question - show different buttons based on whether answers changed */}
            {currentQ === filteredQuestions.length - 1 ? (
              answersChanged ? (
                /* User CHANGED answers → Show only "Generate Posts" button */
                <button
                  onClick={goNext}
                  className="px-6 py-3 rounded-[14px] text-[15px] font-bold text-white"
                  style={{
                    background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                    boxShadow: 'var(--shadow-glow-coral)',
                  }}
                >
                  Generate Posts →
                </button>
              ) : hasPreviousGeneration && onNext ? (
                /* User DID NOT change answers → Show "Previous Posts" and "Regenerate" buttons */
                <div className="flex gap-3">
                  <button
                    onClick={onNext}
                    className="px-6 py-3 rounded-[14px] text-[15px] font-bold"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1.5px solid var(--border-color)',
                      color: 'rgb(var(--c-text-primary))',
                    }}
                  >
                    📋 Previous Posts
                  </button>
                  <button
                    onClick={() => {
                      setHasPreviousGeneration(false);
                      goNext();
                    }}
                    className="px-6 py-3 rounded-[14px] text-[15px] font-bold text-white"
                    style={{
                      background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                      boxShadow: 'var(--shadow-glow-coral)',
                    }}
                  >
                    🔄 Regenerate
                  </button>
                </div>
              ) : (
                /* Default for new users (no previous generation) */
                <button
                  onClick={goNext}
                  className="px-6 py-3 rounded-[14px] text-[15px] font-bold text-white"
                  style={{
                    background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                    boxShadow: 'var(--shadow-glow-coral)',
                  }}
                >
                  Generate Posts →
                </button>
              )
            ) : (
              /* Not last question → Regular Next button */
              <button
                onClick={goNext}
                className="px-6 py-3 rounded-[14px] text-[15px] font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                  boxShadow: 'var(--shadow-glow-coral)',
                }}
              >
                Next →
              </button>
            )}
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
