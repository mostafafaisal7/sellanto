import { useDiamondStore } from '../../store/diamondStore';

interface DiamondCostIndicatorProps {
  cost: number;
  className?: string;
  showLabel?: boolean;
}

export function DiamondCostIndicator({ cost, className = '', showLabel = false }: DiamondCostIndicatorProps) {
  const wallet = useDiamondStore((s) => s.wallet);
  const canAfford = (wallet?.balance ?? 0) >= cost;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium
        ${canAfford ? 'text-cyan-400' : 'text-red-400'}
        ${className}`}
      title={`Costs ${cost} Diamond Tokens`}
    >
      <span>◆</span>
      <span>{cost}</span>
      {showLabel && <span className="text-text-muted ml-0.5">diamonds</span>}
    </span>
  );
}

export default DiamondCostIndicator;
