import { useState } from 'react';
import { diamondService } from '../../services/diamondService';

interface DiamondRechargeFormProps {
  userId: number;
  username: string;
  currentBalance?: number;
  onRecharged?: () => void;
}

export function DiamondRechargeForm({ userId, username, currentBalance, onRecharged }: DiamondRechargeFormProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const presets = [100, 500, 1000, 2500, 5000, 10000];

  const handleRecharge = async () => {
    const amt = parseInt(amount);
    if (!amt || amt <= 0) {
      setError('Enter a valid amount');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await diamondService.rechargeUser(userId, amt, note || undefined);
      setSuccess(`Added ${amt.toLocaleString()} diamonds. New balance: ${result.new_balance.toLocaleString()}`);
      setAmount('');
      setNote('');
      setTimeout(() => setSuccess(''), 5000);
      onRecharged?.();
    } catch {
      setError('Failed to recharge');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02]">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl text-cyan-400">◆</span>
        <h4 className="font-semibold text-white">Recharge Diamonds</h4>
      </div>

      {currentBalance !== undefined && (
        <div className="mb-4 p-3 bg-slate-800/50 rounded-lg flex items-center justify-between">
          <span className="text-sm text-slate-400">{username}'s balance</span>
          <span className="text-lg font-bold text-cyan-400">◆ {currentBalance.toLocaleString()}</span>
        </div>
      )}

      {/* Preset amounts */}
      <div className="flex flex-wrap gap-2 mb-3">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => setAmount(String(p))}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              amount === String(p)
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-slate-800 text-slate-400 border border-white/5 hover:border-white/10'
            }`}
          >
            ◆ {p.toLocaleString()}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Custom amount"
          className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-green-400">{success}</p>}

        <button
          onClick={handleRecharge}
          disabled={loading || !amount}
          className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? 'Recharging...' : `Add ◆ ${amount ? parseInt(amount).toLocaleString() : '0'} Diamonds`}
        </button>
      </div>
    </div>
  );
}

export default DiamondRechargeForm;
