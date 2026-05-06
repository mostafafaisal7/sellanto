import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDiamondStore } from '../../store/diamondStore';

interface DiamondBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function DiamondBadge({ className = '', size = 'md' }: DiamondBadgeProps) {
  const { wallet, fetchWallet } = useDiamondStore();
  const navigate = useNavigate();
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!wallet) fetchWallet();
  }, [wallet, fetchWallet]);

  const balance = wallet?.balance ?? 0;
  const isLow = balance < 50;

  return (
    <div className="tooltip-container relative">
      <button
        type="button"
        onClick={() => navigate('/analytics/diamond')}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer transition-all hover:scale-105
          ${isLow
            ? 'bg-coral/10 text-coral border border-coral/20 hover:bg-coral/15'
            : 'bg-green/10 text-green border border-green/20 hover:bg-green/15'
          }
          ${size === 'sm' ? 'text-xs' : 'text-[13px]'} font-semibold ${className}`}
        title={`Diamond Token Balance: ${balance.toLocaleString()} — click for analytics`}
      >
        <span>💎</span>
        <span>{balance.toLocaleString()}</span>
      </button>

      {showTooltip && (
        <div
          className="absolute right-0 top-full mt-2 w-56 p-3 rounded-xl z-50 pointer-events-none"
          style={{
            background: 'rgb(var(--c-bg-elevated))',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
          }}
        >
          <p className="text-xs text-text-secondary leading-relaxed">
            Diamond tokens power AI features.
            <br />Click to view usage analytics &amp; runway.
          </p>
        </div>
      )}
    </div>
  );
}

export default DiamondBadge;
