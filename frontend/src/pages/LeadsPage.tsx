/**
 * LeadsPage — /leads
 * ==================
 * Displays Facebook Lead Ad form submissions retrieved via leads_retrieval permission.
 * Users can view all their Lead Ad forms and browse individual submissions per form.
 *
 * Permission: leads_retrieval
 * Backend endpoints (need to be created):
 *   GET /api/v1/leads/forms/         — list all Lead Ad forms from connected FB pages
 *   GET /api/v1/leads/forms/<id>/submissions/ — get submissions for a form
 *   POST /api/v1/leads/sync/         — force-sync from Facebook Graph API
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserGroupIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  EnvelopeIcon,
  PhoneIcon,
  UserIcon,
  CalendarIcon,
  FunnelIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { Button, Card, Spinner } from '../components/ui';
import api from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeadForm {
  id: string;
  name: string;
  page_id: string;
  page_name: string;
  status: 'active' | 'archived';
  leads_count: number;
  created_time: string;
}

interface LeadSubmission {
  id: string;
  created_time: string;
  field_data: { name: string; values: string[] }[];
}

type FilterStatus = 'all' | 'new' | 'contacted';

// ── Service helpers ───────────────────────────────────────────────────────────

const leadsService = {
  async getForms(): Promise<{ forms: LeadForm[] }> {
    const res = await api.get('/leads/forms/');
    return res.data;
  },
  async getSubmissions(formId: string): Promise<{ submissions: LeadSubmission[] }> {
    const res = await api.get(`/leads/forms/${formId}/submissions/`);
    return res.data;
  },
  async sync(): Promise<{ synced: number }> {
    const res = await api.post('/leads/sync/');
    return res.data;
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldValue({ name, values }: { name: string; values: string[] }) {
  const icons: Record<string, React.ElementType> = {
    email: EnvelopeIcon,
    phone_number: PhoneIcon,
    full_name: UserIcon,
    first_name: UserIcon,
    last_name: UserIcon,
  };
  const Icon = icons[name] ?? DocumentTextIcon;
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-text-muted uppercase tracking-wide">
          {name.replace(/_/g, ' ')}
        </p>
        <p className="text-sm text-text-primary">{values.join(', ') || '—'}</p>
      </div>
    </div>
  );
}

function LeadCard({ lead }: { lead: LeadSubmission }) {
  const [expanded, setExpanded] = useState(false);
  const mainFields = lead.field_data.slice(0, 3);
  const extraFields = lead.field_data.slice(3);

  return (
    <motion.div
      layout
      className="bg-[#1A1A2E] border border-white/8 rounded-xl p-4 hover:border-white/15 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          {mainFields.map((f) => (
            <FieldValue key={f.name} name={f.name} values={f.values} />
          ))}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-text-muted">
            {new Date(lead.created_time).toLocaleDateString()}
          </p>
          <p className="text-[10px] text-text-muted">
            {new Date(lead.created_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {extraFields.length > 0 && (
        <>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-white/8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {extraFields.map((f) => (
                    <FieldValue key={f.name} name={f.name} values={f.values} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs text-coral hover:text-coral/80 transition-colors"
          >
            {expanded ? 'Show less' : `+${extraFields.length} more fields`}
          </button>
        </>
      )}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function LeadsPage() {
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [selectedForm, setSelectedForm] = useState<LeadForm | null>(null);
  const [submissions, setSubmissions] = useState<LeadSubmission[]>([]);
  const [loadingForms, setLoadingForms] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');

  const fetchForms = useCallback(async () => {
    setLoadingForms(true);
    setError(null);
    try {
      const data = await leadsService.getForms();
      setForms(data.forms || []);
    } catch {
      setError('Could not load Lead Ad forms. Make sure your Facebook page is connected with leads permission.');
    } finally {
      setLoadingForms(false);
    }
  }, []);

  const fetchSubmissions = useCallback(async (form: LeadForm) => {
    setSelectedForm(form);
    setLoadingSubmissions(true);
    setSubmissions([]);
    try {
      const data = await leadsService.getSubmissions(form.id);
      setSubmissions(data.submissions || []);
    } catch {
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await leadsService.sync();
      await fetchForms();
      if (selectedForm) await fetchSubmissions(selectedForm);
    } finally {
      setSyncing(false);
    }
  };

  const handleExportCSV = () => {
    if (!submissions.length) return;
    const allFields = Array.from(new Set(submissions.flatMap((s) => s.field_data.map((f) => f.name))));
    const header = ['submitted_at', ...allFields].join(',');
    const rows = submissions.map((s) => {
      const fieldMap = Object.fromEntries(s.field_data.map((f) => [f.name, f.values.join('; ')]));
      return [s.created_time, ...allFields.map((k) => `"${fieldMap[k] || ''}"`)].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${selectedForm?.name || 'export'}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  const filteredSubmissions = submissions.filter((s) => {
    const text = s.field_data.flatMap((f) => f.values).join(' ').toLowerCase();
    return text.includes(search.toLowerCase());
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <UserGroupIcon className="w-7 h-7 text-coral" />
            Facebook Leads
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            View and manage form submissions from your Facebook Lead Ad campaigns.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2"
        >
          <ArrowPathIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync from Facebook'}
        </Button>
      </div>

      {/* Permission info banner */}
      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <LinkIcon className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-300">leads_retrieval permission active</p>
          <p className="text-xs text-blue-400/80 mt-0.5">
            SellAnto retrieves lead submissions from your Facebook Lead Ad forms. Leads are synced automatically every hour
            and can be exported as CSV for your CRM.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <ExclamationCircleIcon className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Form list */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider px-1">
            Lead Ad Forms
          </h2>

          {loadingForms ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="w-6 h-6 text-coral" />
            </div>
          ) : forms.length === 0 ? (
            <Card className="p-6 text-center">
              <DocumentTextIcon className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <p className="text-sm font-medium text-text-primary">No Lead Ad forms found</p>
              <p className="text-xs text-text-muted mt-1">
                Create a Lead Ad campaign on Facebook and connect your page to see forms here.
              </p>
            </Card>
          ) : (
            forms.map((form) => (
              <motion.button
                key={form.id}
                whileHover={{ x: 2 }}
                onClick={() => fetchSubmissions(form)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedForm?.id === form.id
                    ? 'bg-coral/10 border-coral/40 text-text-primary'
                    : 'bg-[#1A1A2E] border-white/8 text-text-secondary hover:border-white/20 hover:text-text-primary'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{form.name}</p>
                    <p className="text-xs text-text-muted mt-0.5 truncate">{form.page_name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-lg font-bold text-coral">{form.leads_count}</span>
                    <p className="text-[10px] text-text-muted">leads</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    form.status === 'active'
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-gray-500/15 text-gray-400'
                  }`}>
                    {form.status}
                  </span>
                  <span className="text-[10px] text-text-muted flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" />
                    {new Date(form.created_time).toLocaleDateString()}
                  </span>
                </div>
                <ChevronRightIcon className={`w-4 h-4 mt-2 ${
                  selectedForm?.id === form.id ? 'text-coral' : 'text-text-muted'
                }`} />
              </motion.button>
            ))
          )}
        </div>

        {/* Right — Submissions */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedForm ? (
            <Card className="p-12 text-center">
              <UserGroupIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <p className="text-sm font-medium text-text-primary">Select a Lead Ad Form</p>
              <p className="text-xs text-text-muted mt-1">
                Choose a form from the left to view its submissions.
              </p>
            </Card>
          ) : (
            <>
              {/* Submissions header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">{selectedForm.name}</h2>
                  <p className="text-xs text-text-muted">{selectedForm.page_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleExportCSV}
                    disabled={!submissions.length}
                    className="flex items-center gap-2"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    Export CSV
                  </Button>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Leads', value: submissions.length, icon: UserGroupIcon, color: 'text-coral' },
                  { label: 'This Week', value: submissions.filter(s => {
                    const d = new Date(s.created_time);
                    const week = new Date(); week.setDate(week.getDate() - 7);
                    return d >= week;
                  }).length, icon: ClockIcon, color: 'text-blue-400' },
                  { label: 'Today', value: submissions.filter(s =>
                    new Date(s.created_time).toDateString() === new Date().toDateString()
                  ).length, icon: CheckCircleIcon, color: 'text-green-400' },
                ].map((stat) => (
                  <Card key={stat.label} className="p-3 text-center">
                    <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-1`} />
                    <p className="text-xl font-bold text-text-primary">{stat.value}</p>
                    <p className="text-[10px] text-text-muted">{stat.label}</p>
                  </Card>
                ))}
              </div>

              {/* Search + filter */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search leads…"
                    className="w-full pl-9 pr-4 py-2 bg-[#1A1A2E] border border-white/10 rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-coral/50"
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-[#1A1A2E] border border-white/10 rounded-lg p-1">
                  {(['all', 'new', 'contacted'] as FilterStatus[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                        filter === f
                          ? 'bg-coral text-white'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submissions list */}
              {loadingSubmissions ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner className="w-6 h-6 text-coral" />
                </div>
              ) : filteredSubmissions.length === 0 ? (
                <Card className="p-10 text-center">
                  <FunnelIcon className="w-10 h-10 text-text-muted mx-auto mb-3" />
                  <p className="text-sm font-medium text-text-primary">No submissions yet</p>
                  <p className="text-xs text-text-muted mt-1">
                    Leads will appear here once people submit your Facebook Lead Ad form.
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredSubmissions.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
