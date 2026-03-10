import { useEffect } from 'react';
import { useDiamondStore } from '../../store/diamondStore';

export function DiamondBalanceWidget() {
  const { wallet, walletLoading, fetchWallet, usage, usageLoading, fetchUsage } = useDiamondStore();

  useEffect(() => {
    fetchWallet();
    fetchUsage(30);
  }, [fetchWallet, fetchUsage]);

  if (walletLoading && !wallet) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="h-4 bg-dark-600 rounded w-1/3 mb-4" />
        <div className="h-8 bg-dark-600 rounded w-1/2 mb-4" />
        <div className="h-3 bg-dark-600 rounded w-full" />
      </div>
    );
  }

  const balance = wallet?.balance ?? 0;
  const totalRecharged = wallet?.total_recharged ?? 0;
  const totalSpent = wallet?.total_spent ?? 0;
  const usagePercent = totalRecharged > 0 ? Math.min((totalSpent / totalRecharged) * 100, 100) : 0;
  const isLow = balance < 50;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-text-secondary">Diamond Tokens</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${isLow ? 'bg-red-500/10 text-red-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
          {isLow ? 'Low Balance' : 'Active'}
        </span>
      </div>

      {/* Balance */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`text-2xl ${isLow ? 'text-red-400' : 'text-cyan-400'}`}>◆</span>
        <span className="text-3xl font-bold text-text-primary">{balance.toLocaleString()}</span>
      </div>

      {/* Usage bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-text-muted mb-1">
          <span>Spent: ◆ {totalSpent.toLocaleString()}</span>
          <span>Recharged: ◆ {totalRecharged.toLocaleString()}</span>
        </div>
        <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-yellow-500' : 'bg-cyan-500'}`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </div>

      {/* Per-provider breakdown */}
      {!usageLoading && usage?.by_provider && usage.by_provider.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-white/5">
          <p className="text-xs text-text-muted mb-2">By Provider (30d)</p>
          {usage.by_provider.map((p) => (
            <div key={p.provider} className="flex items-center justify-between text-xs">
              <span className="text-text-secondary capitalize">{p.provider || 'Unknown'}</span>
              <span className="text-text-primary font-medium">◆ {p.diamonds_spent.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DiamondBalanceWidget;
