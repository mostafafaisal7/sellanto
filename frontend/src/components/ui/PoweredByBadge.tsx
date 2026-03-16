import { clsx } from 'clsx';
import { BoltIcon } from '@heroicons/react/24/outline';

interface PoweredByBadgeProps {
  provider?: string;
  model?: string;
  className?: string;
}

const providerDisplayNames: Record<string, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  claude: 'Anthropic Claude',
  anthropic: 'Anthropic Claude',
};

function getProviderName(provider: string): string {
  const key = provider.toLowerCase();
  return providerDisplayNames[key] || provider;
}

function formatModelName(model: string): string {
  if (!model) return '';
  // Clean up common model ID prefixes for display
  return model
    .replace('claude-', 'Claude ')
    .replace('gpt-', 'GPT-')
    .replace('dall-e-', 'DALL-E ')
    .replace('tts-', 'TTS-')
    .replace('veo-', 'Veo ')
    .replace('gemini-', 'Gemini ');
}

export function PoweredByBadge({ provider, model, className }: PoweredByBadgeProps) {
  if (!provider && !model) return null;

  const displayProvider = provider ? getProviderName(provider) : '';
  const displayModel = model ? formatModelName(model) : '';

  const label = displayProvider && displayModel
    ? `${displayProvider} - ${displayModel}`
    : displayProvider || displayModel;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full',
        'bg-dark-500/60 text-text-tertiary border border-dark-400/30',
        className
      )}
    >
      <BoltIcon className="w-3 h-3" />
      Powered by {label}
    </span>
  );
}

export default PoweredByBadge;
