import { useEffect } from 'react';
import { useDiamondStore } from '../../store/diamondStore';

interface DiamondBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function DiamondBadge({ className = '', size = 'md' }: DiamondBadgeProps) {
  const { wallet, fetchWallet } = useDiamondStore();

  useEffect(() => {
    if (!wallet) fetchWallet();
  }, [wallet, fetchWallet]);

  const balance = wallet?.balance ?? 0;
  const isLow = balance < 50;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg
        ${isLow ? 'bg-red-500/10 text-red-400' : 'bg-cyan-500/10 text-cyan-400'}
        ${size === 'sm' ? 'text-xs' : 'text-sm'} font-semibold ${className}`}
      title={`Diamond Token Balance: ${balance.toLocaleString()}`}
    >
      <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>◆</span>
      <span>{balance.toLocaleString()}</span>
    </div>
  );
}

export default DiamondBadge;
