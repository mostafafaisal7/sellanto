import { useEffect } from 'react';
import { useDiamondStore } from '../../store/diamondStore';

export function InsufficientDiamondsModal() {
  const { showInsufficientModal, insufficientData, closeInsufficientModal, openInsufficientModal } = useDiamondStore();

  // Listen for global 402 events from the API interceptor
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      openInsufficientModal(detail.cost, detail.balance, detail.feature);
    };
    window.addEventListener('insufficient-diamonds', handler);
    return () => window.removeEventListener('insufficient-diamonds', handler);
  }, [openInsufficientModal]);

  if (!showInsufficientModal || !insufficientData) return null;

  const { cost, balance, feature } = insufficientData;
  const deficit = cost - balance;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeInsufficientModal} />

      {/* Modal */}
      <div className="relative w-full max-w-sm mx-4 bg-dark-800 border border-white/10 rounded-2xl p-6 shadow-2xl">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <span className="text-3xl text-red-400">◆</span>
          </div>
        </div>

        <h3 className="text-lg font-bold text-text-primary text-center mb-2">
          Insufficient Diamond Tokens
        </h3>

        {feature && (
          <p className="text-sm text-text-secondary text-center mb-4">
            <span className="capitalize">{feature.replace(/_/g, ' ')}</span> requires more diamonds
          </p>
        )}

        {/* Cost breakdown */}
        <div className="space-y-2 mb-6 p-4 bg-dark-700/50 rounded-xl">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Required</span>
            <span className="text-text-primary font-semibold">◆ {cost.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Your balance</span>
            <span className="text-red-400 font-semibold">◆ {balance.toLocaleString()}</span>
          </div>
          <hr className="border-white/5" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Shortfall</span>
            <span className="text-red-400 font-semibold">◆ {deficit.toLocaleString()}</span>
          </div>
        </div>

        <p className="text-xs text-text-muted text-center mb-4">
          Contact your administrator to recharge your Diamond Tokens.
        </p>

        <button
          onClick={closeInsufficientModal}
          className="w-full py-2.5 bg-dark-600 hover:bg-dark-500 text-text-primary rounded-xl text-sm font-medium transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export default InsufficientDiamondsModal;
