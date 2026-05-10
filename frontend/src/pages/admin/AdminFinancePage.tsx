import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  ChartBarSquareIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  PlusIcon,
  ReceiptRefundIcon,
  ScaleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, Input, Modal } from '../../components/ui';
import {
  financeService,
  type AutoExpensesResponse,
  type ExpenseCategory,
  type ExpenseEntry,
  type FinanceSummary,
  type RevenueEntry,
} from '../../services/financeService';

const COLORS = {
  coral: '#E8364F',
  green: '#10B981',
  amber: '#F59E0B',
  purple: '#8B5CF6',
  blue: '#3B82F6',
  textMuted: '#6B7280',
  textSecondary: '#9CA3AF',
  textPrimary: '#F1F1F6',
  bgCard: '#16162A',
};

const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  server: COLORS.blue,
  domain: COLORS.blue,
  storage: COLORS.blue,
  database: COLORS.blue,
  email: COLORS.blue,
  openai: COLORS.green,
  gemini: COLORS.amber,
  claude: COLORS.purple,
  other_api: COLORS.coral,
  marketing: COLORS.coral,
  payroll: COLORS.purple,
  legal: COLORS.textMuted,
  other: COLORS.textMuted,
};

function fmtUSD(s: string | number): string {
  const n = typeof s === 'string' ? Number(s) : s;
  if (!isFinite(n)) return '$0';
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtMonth(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext?: string;
  accent: string;
  positive?: boolean;
  delay?: number;
}
function StatCard({ icon: Icon, label, value, subtext, accent, positive, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-bg-card p-5"
    >
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-[80px] opacity-25 pointer-events-none"
        style={{ background: accent }}
      />
      <div className="relative flex items-center justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${accent}25`, border: `1px solid ${accent}40`, color: accent }}
        >
          <Icon className="w-[18px] h-[18px]" />
        </div>
        {positive !== undefined && (
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
              positive
                ? 'text-green bg-green/10 border border-green/20'
                : 'text-coral bg-coral/10 border border-coral/20'
            }`}
          >
            {positive ? 'profit' : 'loss'}
          </span>
        )}
      </div>
      <div className="relative text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </div>
      <div className="relative mt-1.5 text-2xl md:text-3xl font-extrabold font-heading text-text-primary tracking-tight">
        {value}
      </div>
      {subtext && <div className="relative mt-1 text-xs text-text-secondary">{subtext}</div>}
    </motion.div>
  );
}

export function AdminFinancePage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<'overview' | 'revenue' | 'expenses' | 'auto'>('overview');

  // Auto-calculated API expenses tab state
  const [autoData, setAutoData] = useState<AutoExpensesResponse | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);

  // Expenses tab state
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | ''>('');
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState<{
    category: ExpenseCategory;
    amount_usd: string;
    description: string;
    incurred_on: string;
  }>({
    category: 'server',
    amount_usd: '',
    description: '',
    incurred_on: new Date().toISOString().slice(0, 10),
  });
  const [savingExpense, setSavingExpense] = useState(false);

  // Revenue tab state
  const [revenue, setRevenue] = useState<RevenueEntry[]>([]);
  const [revenueLoading, setRevenueLoading] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await financeService.getSummary({ months: 12 });
      setSummary(data);
    } catch (err) {
      const e = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      setError(e?.response?.data?.error || e?.message || 'Failed to load finance summary');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExpenses = useCallback(async () => {
    setExpensesLoading(true);
    try {
      const data = await financeService.getExpenses({
        category: categoryFilter || undefined,
        limit: 500,
      });
      setExpenses(data.expenses);
    } finally {
      setExpensesLoading(false);
    }
  }, [categoryFilter]);

  const loadRevenue = useCallback(async () => {
    setRevenueLoading(true);
    try {
      const { revenue } = await financeService.getRevenue(500);
      setRevenue(revenue);
    } finally {
      setRevenueLoading(false);
    }
  }, []);

  const loadAutoExpenses = useCallback(async () => {
    setAutoLoading(true);
    try {
      const data = await financeService.getAutoExpenses({ months: 12 });
      setAutoData(data);
    } finally {
      setAutoLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);
  useEffect(() => {
    if (section === 'expenses') loadExpenses();
  }, [section, loadExpenses]);
  useEffect(() => {
    if (section === 'revenue') loadRevenue();
  }, [section, loadRevenue]);
  useEffect(() => {
    if (section === 'auto') loadAutoExpenses();
  }, [section, loadAutoExpenses]);

  // ── Handlers ──────────────────────────────────────────
  const openCreateModal = () => {
    setEditingExpense(null);
    setExpenseForm({
      category: 'server',
      amount_usd: '',
      description: '',
      incurred_on: new Date().toISOString().slice(0, 10),
    });
    setShowCreateModal(true);
  };

  const openEditModal = (e: ExpenseEntry) => {
    setEditingExpense(e);
    setExpenseForm({
      category: e.category,
      amount_usd: e.amount_usd,
      description: e.description,
      incurred_on: e.incurred_on || new Date().toISOString().slice(0, 10),
    });
    setShowCreateModal(true);
  };

  const saveExpense = async () => {
    const amount = parseFloat(expenseForm.amount_usd);
    if (!isFinite(amount) || amount <= 0) {
      alert('Please enter a positive amount.');
      return;
    }
    setSavingExpense(true);
    try {
      if (editingExpense) {
        await financeService.updateExpense(editingExpense.id, {
          category: expenseForm.category,
          amount_usd: amount,
          description: expenseForm.description,
          incurred_on: expenseForm.incurred_on,
        });
      } else {
        await financeService.createExpense({
          category: expenseForm.category,
          amount_usd: amount,
          description: expenseForm.description,
          incurred_on: expenseForm.incurred_on,
        });
      }
      setShowCreateModal(false);
      setEditingExpense(null);
      await Promise.all([loadExpenses(), loadSummary()]);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      alert(e?.response?.data?.error || 'Save failed');
    } finally {
      setSavingExpense(false);
    }
  };

  const deleteExpense = async (e: ExpenseEntry) => {
    if (!window.confirm(`Delete this ${e.category_label} expense of ${fmtUSD(e.amount_usd)}?`)) return;
    try {
      await financeService.deleteExpense(e.id);
      await Promise.all([loadExpenses(), loadSummary()]);
    } catch {
      alert('Delete failed');
    }
  };

  // ── Derived data for the chart ─────────────────────────
  const chartData = useMemo(() => {
    if (!summary) return [];
    return summary.by_month.map((m) => ({
      month: fmtMonth(m.month),
      Revenue: parseFloat(m.revenue),
      Expense: parseFloat(m.expense),
      Net: parseFloat(m.net),
    }));
  }, [summary]);

  const categoryChartData = useMemo(() => {
    if (!summary) return [];
    return summary.expense_by_category.map((c) => ({
      label: c.label,
      total: parseFloat(c.total),
      color: CATEGORY_COLOR[c.category] || COLORS.textMuted,
    }));
  }, [summary]);

  if (loading && !summary) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="text-sm text-text-secondary">Loading finance data…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <ExclamationTriangleIcon className="w-10 h-10 mx-auto text-coral mb-2" />
        <p className="text-coral mb-4">{error}</p>
        <Button variant="secondary" onClick={loadSummary}>
          Try again
        </Button>
      </div>
    );
  }
  if (!summary) return null;

  const net = parseFloat(summary.net_profit_usd);
  const revenueAmount = parseFloat(summary.revenue_usd);
  const expenseAmount = parseFloat(summary.expense_usd);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-coral">Admin · Finance</span>
        <h1 className="mt-2 text-3xl md:text-4xl font-extrabold font-heading text-text-primary tracking-tight">
          Revenue, expenses &amp; profit
        </h1>
        <p className="mt-2 text-sm text-text-secondary max-w-2xl">
          All amounts in USD. Subscription revenue is auto-converted from each user's local
          currency at approval time. Manually log API & infrastructure costs to see real
          net profit.
        </p>
      </motion.header>

      {/* Hero stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ArrowTrendingUpIcon}
          label="Total revenue"
          value={fmtUSD(summary.revenue_usd)}
          subtext={`${summary.revenue_count} approved payments`}
          accent={COLORS.green}
          delay={0}
        />
        <StatCard
          icon={ArrowTrendingDownIcon}
          label="Total expenses"
          value={fmtUSD(summary.expense_usd)}
          subtext={`${summary.expense_count} cost entries`}
          accent={COLORS.coral}
          delay={0.05}
        />
        <StatCard
          icon={ScaleIcon}
          label="Net profit"
          value={fmtUSD(summary.net_profit_usd)}
          subtext={
            revenueAmount > 0
              ? `${((net / revenueAmount) * 100).toFixed(1)}% margin`
              : 'No revenue yet'
          }
          accent={net >= 0 ? COLORS.green : COLORS.coral}
          positive={net >= 0}
          delay={0.1}
        />
        <StatCard
          icon={CurrencyDollarIcon}
          label="Burn vs earn"
          value={
            revenueAmount > 0
              ? `${((expenseAmount / revenueAmount) * 100).toFixed(0)}%`
              : '—'
          }
          subtext={
            revenueAmount > 0
              ? `Spending ${((expenseAmount / revenueAmount) * 100).toFixed(0)}¢ per dollar earned`
              : 'No revenue yet'
          }
          accent={COLORS.amber}
          delay={0.15}
        />
      </section>

      {/* Section switcher */}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'revenue', label: 'Revenue' },
          { key: 'expenses', label: 'Manual Expenses' },
          { key: 'auto', label: 'Auto API Costs' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSection(t.key as 'overview' | 'revenue' | 'expenses' | 'auto')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              section === t.key
                ? 'bg-bg-elevated text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Manual / auto split (when auto data already in summary) */}
      {(summary.manual_expense_usd !== undefined || summary.auto_expense_usd !== undefined) && (
        <div className="text-xs text-text-secondary -mt-3">
          Expenses include manual entries ({fmtUSD(summary.manual_expense_usd || '0')})
          + auto-calculated API costs from <code className="text-coral">apiModelCost.md</code> rates
          ({fmtUSD(summary.auto_expense_usd || '0')}).
        </div>
      )}

      {section === 'overview' && (
        <>
          {/* Monthly chart */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-3xl border border-white/[0.08] bg-bg-card p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold font-heading text-text-primary">
                  Monthly revenue vs expenses
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Last 12 months · USD
                </p>
              </div>
              <ChartBarSquareIcon className="w-5 h-5 text-text-muted" />
            </div>
            <div className="h-72">
              {chartData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2">
                  <ChartBarSquareIcon className="w-10 h-10 text-text-muted/40" />
                  <p className="text-sm text-text-secondary">No data yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      stroke={COLORS.textMuted}
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                    />
                    <YAxis
                      stroke={COLORS.textMuted}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) =>
                        v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                      }
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      contentStyle={{
                        background: COLORS.bgCard,
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 12,
                        fontSize: 12,
                        color: COLORS.textPrimary,
                      }}
                      formatter={(value) => fmtUSD(Number(value ?? 0))}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Revenue" fill={COLORS.green} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expense" fill={COLORS.coral} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.section>

          {/* Two-col: expense by category + recent activity */}
          <section className="grid lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-3xl border border-white/[0.08] bg-bg-card p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold font-heading text-text-primary">
                    Expenses by category
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    {summary.expense_by_category.length} categories
                  </p>
                </div>
                <ReceiptRefundIcon className="w-5 h-5 text-text-muted" />
              </div>
              {categoryChartData.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center gap-2">
                  <p className="text-sm text-text-secondary">No expenses logged yet</p>
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryChartData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                      <XAxis
                        type="number"
                        stroke={COLORS.textMuted}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        stroke={COLORS.textMuted}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={120}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        contentStyle={{
                          background: COLORS.bgCard,
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 12,
                          fontSize: 12,
                          color: COLORS.textPrimary,
                        }}
                        formatter={(value) => fmtUSD(Number(value ?? 0))}
                      />
                      <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                        {categoryChartData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-3xl border border-white/[0.08] bg-bg-card p-6"
            >
              <h2 className="text-lg font-bold font-heading text-text-primary mb-5">
                Recent activity
              </h2>
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 no-scrollbar">
                {[
                  ...summary.recent_revenue.slice(0, 4).map((r) => ({
                    kind: 'revenue' as const,
                    id: `rev-${r.id}`,
                    label: `${r.user?.username || '—'} → ${r.plan.toUpperCase()}`,
                    sub: `${r.amount_local} ${r.local_currency} · ${r.payment_method_label}`,
                    amount: fmtUSD(r.revenue_usd),
                    date: r.reviewed_at,
                  })),
                  ...summary.recent_expenses.slice(0, 4).map((e) => ({
                    kind: 'expense' as const,
                    id: `exp-${e.id}`,
                    label: e.category_label,
                    sub: e.description || '(no description)',
                    amount: fmtUSD(e.amount_usd),
                    date: e.incurred_on,
                  })),
                ]
                  .sort((a, b) => (a.date && b.date ? (a.date < b.date ? 1 : -1) : 0))
                  .slice(0, 8)
                  .map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          row.kind === 'revenue'
                            ? 'bg-green/15 text-green'
                            : 'bg-coral/15 text-coral'
                        }`}
                      >
                        {row.kind === 'revenue' ? (
                          <ArrowTrendingUpIcon className="w-5 h-5" />
                        ) : (
                          <ArrowTrendingDownIcon className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-text-primary truncate">
                          {row.label}
                        </div>
                        <div className="text-[11px] text-text-muted truncate">{row.sub}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div
                          className={`text-sm font-mono font-bold ${
                            row.kind === 'revenue' ? 'text-green' : 'text-coral'
                          }`}
                        >
                          {row.kind === 'revenue' ? '+' : '−'}
                          {row.amount}
                        </div>
                        <div className="text-[10px] text-text-muted">{fmtDate(row.date)}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </motion.div>
          </section>
        </>
      )}

      {/* Revenue tab */}
      {section === 'revenue' && (
        <RevenueTable revenue={revenue} loading={revenueLoading} />
      )}

      {/* Expenses tab */}
      {section === 'expenses' && (
        <ExpensesTable
          expenses={expenses}
          loading={expensesLoading}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          onAdd={openCreateModal}
          onEdit={openEditModal}
          onDelete={deleteExpense}
        />
      )}

      {/* Auto-calculated API costs tab */}
      {section === 'auto' && (
        <AutoExpensesPanel data={autoData} loading={autoLoading} onRefresh={loadAutoExpenses} />
      )}

      {/* Create / edit expense modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          if (!savingExpense) {
            setShowCreateModal(false);
            setEditingExpense(null);
          }
        }}
        size="md"
        showCloseButton={!savingExpense}
      >
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-coral/20 text-coral flex items-center justify-center">
              <BanknotesIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">
                {editingExpense ? 'Edit expense' : 'Log new expense'}
              </h3>
              <p className="text-xs text-text-muted">
                Amount in USD. Use today's date or backdate as needed.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5 font-medium">
                Category *
              </label>
              <select
                value={expenseForm.category}
                onChange={(e) =>
                  setExpenseForm({ ...expenseForm, category: e.target.value as ExpenseCategory })
                }
                className="w-full bg-bg-elevated border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-text-primary focus:border-coral focus:outline-none"
              >
                <option value="server">Server / Hosting</option>
                <option value="domain">Domain & SSL</option>
                <option value="storage">Storage / CDN</option>
                <option value="database">Database hosting</option>
                <option value="email">Email service</option>
                <option value="openai">OpenAI API</option>
                <option value="gemini">Gemini API</option>
                <option value="claude">Claude API</option>
                <option value="other_api">Other API / SaaS</option>
                <option value="marketing">Marketing / Ads</option>
                <option value="payroll">Payroll / Contractors</option>
                <option value="legal">Legal / Accounting</option>
                <option value="other">Other</option>
              </select>
            </div>
            <Input
              label="Amount (USD) *"
              type="number"
              placeholder="0.00"
              value={expenseForm.amount_usd}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount_usd: e.target.value })}
            />
            <Input
              label="Date incurred"
              type="date"
              value={expenseForm.incurred_on}
              onChange={(e) => setExpenseForm({ ...expenseForm, incurred_on: e.target.value })}
            />
            <div>
              <label className="block text-xs text-text-secondary mb-1.5 font-medium">
                Description (optional)
              </label>
              <textarea
                rows={2}
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder="e.g. AWS EC2 + RDS, May invoice"
                className="w-full bg-bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:border-coral focus:outline-none resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setShowCreateModal(false);
                setEditingExpense(null);
              }}
              disabled={savingExpense}
            >
              Cancel
            </Button>
            <Button fullWidth onClick={saveExpense} isLoading={savingExpense}>
              {editingExpense ? 'Save changes' : 'Add expense'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Revenue table ────────────────────────────────────────────────────
function RevenueTable({ revenue, loading }: { revenue: RevenueEntry[]; loading: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-white/[0.08] bg-bg-card overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <h2 className="text-sm font-bold text-text-primary">All approved payments</h2>
        <p className="text-[11px] text-text-muted mt-0.5">
          Each row is a credit on the ledger. Local currency converted to USD at approval.
        </p>
      </div>
      {loading ? (
        <div className="py-16 text-center text-sm text-text-secondary">Loading…</div>
      ) : revenue.length === 0 ? (
        <div className="py-16 text-center">
          <CheckCircleIcon className="w-10 h-10 mx-auto text-text-muted/40 mb-2" />
          <p className="text-sm text-text-secondary">No approved payments yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-white/[0.04]">
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider">User</th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider">Plan</th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider">Method</th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider">Reference</th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Paid</th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Revenue (USD)</th>
              </tr>
            </thead>
            <tbody>
              {revenue.map((r) => (
                <tr key={r.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-text-secondary whitespace-nowrap">{fmtDate(r.reviewed_at)}</td>
                  <td className="px-5 py-3">
                    <div className="font-semibold text-text-primary">{r.user?.username || '—'}</div>
                    <div className="text-[11px] text-text-muted">{r.user?.email}</div>
                  </td>
                  <td className="px-5 py-3 text-text-primary font-semibold">{r.plan.toUpperCase()}</td>
                  <td className="px-5 py-3 text-text-secondary">{r.payment_method_label}</td>
                  <td className="px-5 py-3 font-mono text-[12px] text-text-secondary max-w-[180px] truncate">
                    {r.transaction_reference || '—'}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-text-primary">
                    {r.amount_local} {r.local_currency}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-green">
                    {fmtUSD(r.revenue_usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

// ─── Expenses table ───────────────────────────────────────────────────
interface ExpensesTableProps {
  expenses: ExpenseEntry[];
  loading: boolean;
  categoryFilter: ExpenseCategory | '';
  setCategoryFilter: (c: ExpenseCategory | '') => void;
  onAdd: () => void;
  onEdit: (e: ExpenseEntry) => void;
  onDelete: (e: ExpenseEntry) => void;
}
function ExpensesTable({
  expenses,
  loading,
  categoryFilter,
  setCategoryFilter,
  onAdd,
  onEdit,
  onDelete,
}: ExpensesTableProps) {
  const total = expenses.reduce((acc, e) => acc + parseFloat(e.amount_usd), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-white/[0.08] bg-bg-card overflow-hidden"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div>
          <h2 className="text-sm font-bold text-text-primary">Expense ledger</h2>
          <p className="text-[11px] text-text-muted mt-0.5">
            Manually-logged costs. Use these to compute true net profit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | '')}
            className="bg-bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-text-primary focus:border-coral focus:outline-none"
          >
            <option value="">All categories</option>
            <option value="server">Server / Hosting</option>
            <option value="openai">OpenAI API</option>
            <option value="gemini">Gemini API</option>
            <option value="claude">Claude API</option>
            <option value="other_api">Other API</option>
            <option value="marketing">Marketing</option>
            <option value="payroll">Payroll</option>
            <option value="other">Other</option>
          </select>
          <Button size="sm" onClick={onAdd} leftIcon={<PlusIcon className="w-4 h-4" />}>
            Add expense
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-text-secondary">Loading…</div>
      ) : expenses.length === 0 ? (
        <div className="py-16 text-center">
          <BanknotesIcon className="w-10 h-10 mx-auto text-text-muted/40 mb-2" />
          <p className="text-sm text-text-secondary">No expenses yet — start logging your costs.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-white/[0.04]">
                  <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider">Description</th>
                  <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider">Logged by</th>
                  <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Amount</th>
                  <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-text-secondary whitespace-nowrap">
                      {fmtDate(e.incurred_on)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border"
                        style={{
                          color: CATEGORY_COLOR[e.category],
                          background: `${CATEGORY_COLOR[e.category]}15`,
                          borderColor: `${CATEGORY_COLOR[e.category]}30`,
                        }}
                      >
                        {e.category_label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-text-secondary max-w-[240px] truncate">
                      {e.description || '—'}
                    </td>
                    <td className="px-5 py-3 text-[11px] text-text-muted">
                      {e.created_by || '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-coral">
                      −{fmtUSD(e.amount_usd)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(e)}
                          className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-white/[0.05] transition-colors"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(e)}
                          className="p-1.5 rounded-md text-text-secondary hover:text-coral hover:bg-coral/10 transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/[0.06] bg-white/[0.02]">
                  <td colSpan={4} className="px-5 py-3 text-text-muted text-xs uppercase font-bold tracking-wider">
                    Total in filter
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-coral">
                    −{fmtUSD(total)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ─── Auto-calculated API costs panel ─────────────────────────────────
interface AutoExpensesPanelProps {
  data: AutoExpensesResponse | null;
  loading: boolean;
  onRefresh: () => void;
}

const COST_TYPE_COLOR: Record<string, string> = {
  text: COLORS.purple,
  image: COLORS.amber,
  video: COLORS.coral,
  voice: COLORS.blue,
};

function AutoExpensesPanel({ data, loading, onRefresh }: AutoExpensesPanelProps) {
  if (loading && !data) {
    return (
      <div className="rounded-3xl border border-white/[0.08] bg-bg-card p-12 text-center text-sm text-text-secondary">
        Computing API costs from <code className="text-coral">apiModelCost.md</code> rates…
      </div>
    );
  }
  if (!data) return null;

  const total = parseFloat(data.total_usd);
  const monthChartData = data.by_month.map((m) => ({
    month: fmtMonth(m.month),
    Total: parseFloat(m.total),
    OpenAI: parseFloat(m.by_category.openai || '0'),
    Gemini: parseFloat(m.by_category.gemini || '0'),
    Claude: parseFloat(m.by_category.claude || '0'),
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header / hero */}
      <div className="rounded-3xl border border-white/[0.08] bg-bg-card p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Auto-calculated API costs</h2>
            <p className="text-xs text-text-muted mt-1">
              Computed live from every diamond deduction · {data.deduction_count.toLocaleString()} API calls
              tracked · {data.window.from} → {data.window.to}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">
              Rate source: <code className="text-coral">{data.rate_source}</code>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Total cost</div>
              <div className="text-2xl font-extrabold text-coral">{fmtUSD(total)}</div>
            </div>
            <Button variant="secondary" onClick={onRefresh} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>

      {/* By cost type */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {data.by_cost_type.map((c) => (
          <div
            key={c.cost_type}
            className="rounded-2xl border border-white/[0.08] bg-bg-card p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded"
                style={{
                  background: `${COST_TYPE_COLOR[c.cost_type] || COLORS.textMuted}20`,
                  color: COST_TYPE_COLOR[c.cost_type] || COLORS.textMuted,
                }}
              >
                {c.cost_type}
              </span>
              <span className="text-[10px] text-text-muted">{c.count.toLocaleString()} calls</span>
            </div>
            <div className="text-xl font-extrabold text-text-primary">{fmtUSD(c.total)}</div>
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      {monthChartData.length > 0 && (
        <div className="rounded-3xl border border-white/[0.08] bg-bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Monthly API cost</h3>
              <p className="text-[11px] text-text-muted mt-0.5">Stacked by provider</p>
            </div>
            <ChartBarSquareIcon className="w-5 h-5 text-text-muted" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke={COLORS.textMuted}
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                />
                <YAxis
                  stroke={COLORS.textMuted}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{
                    background: COLORS.bgCard,
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12,
                    fontSize: 12,
                    color: COLORS.textPrimary,
                  }}
                  formatter={(value) => fmtUSD(Number(value ?? 0))}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Claude" stackId="a" fill={COLORS.purple} />
                <Bar dataKey="Gemini" stackId="a" fill={COLORS.amber} />
                <Bar dataKey="OpenAI" stackId="a" fill={COLORS.green} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* By feature breakdown */}
      <div className="rounded-3xl border border-white/[0.08] bg-bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-bold text-text-primary">Cost by feature</h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            Each row aggregates every API call for that feature, tokens included
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-white/[0.04]">
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider">Feature</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider">Type</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider">Provider</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Calls</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Tokens</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.by_feature.map((f) => (
                <tr key={f.feature} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-mono text-text-primary text-xs">{f.feature}</td>
                  <td className="px-5 py-3">
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded"
                      style={{
                        background: `${COST_TYPE_COLOR[f.cost_type] || COLORS.textMuted}20`,
                        color: COST_TYPE_COLOR[f.cost_type] || COLORS.textMuted,
                      }}
                    >
                      {f.cost_type}
                    </span>
                  </td>
                  <td className="px-5 py-3 capitalize text-text-secondary text-xs">{f.category}</td>
                  <td className="px-5 py-3 text-right font-mono text-text-secondary">
                    {f.count.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-text-secondary">
                    {f.tokens > 0 ? f.tokens.toLocaleString() : '—'}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-coral">
                    {fmtUSD(f.total)}
                  </td>
                </tr>
              ))}
              {data.by_feature.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-text-muted">
                    No API usage in this window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top users + recent feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-white/[0.08] bg-bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-bold text-text-primary">Top users by cost</h3>
            <p className="text-[11px] text-text-muted mt-0.5">Highest-spending accounts in window</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {data.top_users.length === 0 ? (
              <div className="py-8 text-center text-sm text-text-muted">No users yet.</div>
            ) : (
              data.top_users.map((u) => (
                <div key={u.user_id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm font-semibold text-text-primary">{u.username}</div>
                    <div className="text-[10px] text-text-muted">
                      {u.count.toLocaleString()} API calls · ID #{u.user_id}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-coral">{fmtUSD(u.total)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/[0.08] bg-bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-bold text-text-primary">Recent API calls</h3>
            <p className="text-[11px] text-text-muted mt-0.5">Last 50 deductions with computed cost</p>
          </div>
          <div className="divide-y divide-white/[0.04] max-h-96 overflow-y-auto">
            {data.recent.length === 0 ? (
              <div className="py-8 text-center text-sm text-text-muted">No recent activity.</div>
            ) : (
              data.recent.map((r) => (
                <div key={r.id} className="px-5 py-2.5 hover:bg-white/[0.02]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-text-primary truncate">
                          {r.feature}
                        </span>
                        <span
                          className="px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider rounded shrink-0"
                          style={{
                            background: `${COST_TYPE_COLOR[r.cost_type] || COLORS.textMuted}20`,
                            color: COST_TYPE_COLOR[r.cost_type] || COLORS.textMuted,
                          }}
                        >
                          {r.cost_type}
                        </span>
                      </div>
                      <div className="text-[10px] text-text-muted truncate">
                        {r.user || '—'} · {r.model || r.provider || '—'} · {fmtDate(r.created_at)}
                      </div>
                    </div>
                    <div className="font-mono text-xs font-bold text-coral shrink-0">
                      {fmtUSD(r.cost_usd)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default AdminFinancePage;
