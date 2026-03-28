import {
  MapIcon,
  LightBulbIcon,
  PencilSquareIcon,
  PhotoIcon,
  SparklesIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

const STEPS = [
  { label: 'Strategy', icon: MapIcon },
  { label: 'Ideas', icon: LightBulbIcon },
  { label: 'Captions', icon: PencilSquareIcon },
  { label: 'Media', icon: PhotoIcon },
  { label: 'Post', icon: SparklesIcon },
  { label: 'Calendar', icon: CalendarDaysIcon },
];

interface OnboardingStepperProps {
  currentStep: number;
  completedSteps: number[];
  onStepClick?: (step: number) => void;
}

export function OnboardingStepper({ currentStep, completedSteps, onStepClick }: OnboardingStepperProps) {
  return (
    <div
      className="rounded-[14px] px-6 py-4 mb-5"
      style={{
        background: 'rgb(var(--c-bg-card))',
        border: '1px solid var(--border-color)',
      }}
    >
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const isCompleted = completedSteps.includes(i);
          const isCurrent = i === currentStep;
          const Icon = step.icon;

          let borderColor = 'var(--border-color)';
          let bgColor = 'transparent';
          let iconColor = 'rgb(var(--c-text-muted))';

          if (isCompleted) {
            borderColor = 'rgba(16,185,129,0.4)';
            bgColor = 'rgba(16,185,129,0.1)';
            iconColor = 'rgb(var(--c-green))';
          } else if (isCurrent) {
            borderColor = 'rgba(232,54,79,0.4)';
            bgColor = 'rgba(232,54,79,0.1)';
            iconColor = 'rgb(var(--c-coral))';
          }

          return (
            <div key={step.label} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? 1 : 'none' }}>
              {/* Step circle */}
              <button
                onClick={() => onStepClick?.(i)}
                className="flex flex-col items-center gap-1.5 transition-all duration-300"
                style={{ cursor: onStepClick ? 'pointer' : 'default' }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300"
                  style={{
                    border: `2px solid ${borderColor}`,
                    background: bgColor,
                  }}
                >
                  {isCompleted ? (
                    <CheckCircleIcon className="w-5 h-5" style={{ color: iconColor }} />
                  ) : (
                    <Icon className="w-5 h-5" style={{ color: iconColor }} />
                  )}
                </div>
                <span
                  className="text-[11px] whitespace-nowrap transition-colors duration-300"
                  style={{
                    fontWeight: isCurrent ? 600 : 450,
                    color: isCurrent
                      ? 'rgb(var(--c-coral))'
                      : isCompleted
                        ? 'rgb(var(--c-green))'
                        : 'rgb(var(--c-text-muted))',
                  }}
                >
                  {step.label}
                </span>
              </button>

              {/* Connecting line */}
              {i < STEPS.length - 1 && (
                <div
                  className="stepper-line mx-1.5 mb-5"
                  style={{
                    background: isCompleted
                      ? 'rgb(var(--c-green))'
                      : isCurrent
                        ? 'linear-gradient(90deg, rgb(var(--c-green)), rgb(var(--c-coral)))'
                        : 'var(--border-color)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default OnboardingStepper;
