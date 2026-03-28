import { useEffect, useState } from 'react';
import { useDiamondStore } from '../../store/diamondStore';

interface DiamondBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function DiamondBadge({ className = '', size = 'md' }: DiamondBadgeProps) {
  const { wallet, fetchWallet } = useDiamondStore();
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!wallet) fetchWallet();
  }, [wallet, fetchWallet]);

  const balance = wallet?.balance ?? 0;
  const isLow = balance < 50;

  return (
    <div className="tooltip-container relative">
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-default
          ${isLow
            ? 'bg-coral/10 text-coral border border-coral/20'
            : 'bg-green/10 text-green border border-green/20'
          }
          ${size === 'sm' ? 'text-xs' : 'text-[13px]'} font-semibold ${className}`}
        title={`Diamond Token Balance: ${balance.toLocaleString()}`}
      >
        <span>💎</span>
        <span>{balance.toLocaleString()}</span>
      </div>

      {showTooltip && (
        <div
          className="absolute right-0 top-full mt-2 w-56 p-3 rounded-xl z-50"
          style={{
            background: 'rgb(var(--c-bg-elevated))',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
          }}
        >
          <p className="text-xs text-text-secondary leading-relaxed">
            Diamond tokens power AI features.
            <br />Image gen: ~50 · Captions: ~20 · Trends: ~100
          </p>
        </div>
      )}
    </div>
  );
}

export default DiamondBadge;
