import { useEffect, useState } from 'react';
import {
  ClockIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  BoltIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { Modal, Spinner } from '../ui';
import {
  adminPromptService,
  type AuditEntry,
  type ExecutionRecord,
  type PromptType,
} from '../../services/adminPromptService';

interface Props {
  open: boolean;
  userId: number;
  promptType: PromptType | null;
  promptDisplayName: string;
  onClose: () => void;
}

const ACTION_META: Record<
  AuditEntry['action'],
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  create: { label: 'Created', color: 'text-green', icon: PlusCircleIcon },
  update: { label: 'Updated', color: 'text-coral', icon: PencilSquareIcon },
  delete: { label: 'Deleted', color: 'text-text-muted', icon: TrashIcon },
  activate: { label: 'Activated', color: 'text-green', icon: CheckCircleIcon },
  deactivate: { label: 'Deactivated', color: 'text-text-muted', icon: XCircleIcon },
};

function fmt(date: string) {
  try {
    return new Date(date).toLocaleString();
  } catch {
    return date;
  }
}

type Tab = 'runs' | 'changes';

export function PromptAuditTimeline({
  open,
  userId,
  promptType,
  promptDisplayName,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>('runs');
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [runs, setRuns] = useState<ExecutionRecord[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsTotal, setRunsTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Reset state when modal opens/changes prompt
  useEffect(() => {
    if (!open || !promptType) return;
    setTab('runs');
    setExpanded({});
    setError(null);

    let cancelled = false;

    // Load admin changes
    setAuditLoading(true);
    adminPromptService
      .audit(userId, promptType)
      .then((rows) => {
        if (!cancelled) setAudit(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load audit');
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false);
      });

    // Load execution runs for this prompt type
    setRunsLoading(true);
    adminPromptService
      .executionHistory(userId, { prompt_type: promptType, page: 1, page_size: 50 })
      .then((resp) => {
        if (!cancelled) {
          setRuns(resp.executions);
          setRunsTotal(resp.total);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load runs');
      })
      .finally(() => {
        if (!cancelled) setRunsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, userId, promptType]);

  const toggleExpand = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="xl"
      title={`History · ${promptDisplayName}`}
    >
      {/* Tabs */}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-4">
        <button
          type="button"
          onClick={() => setTab('runs')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            tab === 'runs'
              ? 'bg-bg-elevated text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <BoltIcon className="w-3.5 h-3.5" />
          Runs ({runsTotal})
        </button>
        <button
          type="button"
          onClick={() => setTab('changes')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            tab === 'changes'
              ? 'bg-bg-elevated text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <PencilSquareIcon className="w-3.5 h-3.5" />
          Admin changes ({audit.length})
        </button>
      </div>

      <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
        {error && (
          <div className="text-xs text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* ── Runs tab ── */}
        {tab === 'runs' && (
          <>
            {runsLoading && (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            )}
            {!runsLoading && runs.length === 0 && (
              <div className="text-center py-10">
                <BoltIcon className="w-10 h-10 text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-secondary">No runs yet.</p>
                <p className="text-xs text-text-muted mt-1">
                  Every time this prompt is sent to an AI provider, the input + output will be logged here.
                </p>
              </div>
            )}
            {!runsLoading &&
              runs.map((r) => {
                const isOpen = !!expanded[`run-${r.id}`];
                const total = r.tokens_in + r.tokens_out;
                return (
                  <div
                    key={`run-${r.id}`}
                    className="rounded-xl border border-white/[0.06] bg-bg-card/60 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpand(`run-${r.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]"
                    >
                      <BoltIcon
                        className={`w-5 h-5 flex-shrink-0 ${
                          r.success ? 'text-purple' : 'text-coral'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-text-primary">
                            {r.model_used || 'unknown model'}
                          </span>
                          {r.was_override ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-coral/15 text-coral border border-coral/20">
                              Custom
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.04] text-text-muted border border-white/[0.06]">
                              Default
                            </span>
                          )}
                          {!r.success && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-coral/15 text-coral border border-coral/20">
                              Failed
                            </span>
                          )}
                          {r.brand_name && (
                            <span className="text-[10px] text-text-muted">· {r.brand_name}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-text-muted mt-0.5">
                          {fmt(r.created_at)} · {total.toLocaleString()} tokens
                          {r.latency_ms ? ` · ${(r.latency_ms / 1000).toFixed(1)}s` : ''}
                        </div>
                      </div>
                      {isOpen ? (
                        <ChevronUpIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 space-y-3">
                        {r.error_message && (
                          <div className="text-xs text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2">
                            Error: {r.error_message}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                              Prompt sent ({r.prompt_sent.length.toLocaleString()} chars · all dynamic values filled in)
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(r.prompt_sent)}
                              className="text-[10px] text-text-secondary hover:text-text-primary px-2 py-0.5 rounded hover:bg-white/[0.04]"
                            >
                              Copy
                            </button>
                          </div>
                          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-text-secondary bg-bg-primary/60 border border-white/[0.06] rounded-lg p-3 max-h-72 overflow-y-auto">
                            {r.prompt_sent || '(empty)'}
                          </pre>
                        </div>
                        {r.response_received && (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                                AI response ({r.response_received.length.toLocaleString()} chars)
                              </div>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(r.response_received)}
                                className="text-[10px] text-text-secondary hover:text-text-primary px-2 py-0.5 rounded hover:bg-white/[0.04]"
                              >
                                Copy
                              </button>
                            </div>
                            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-text-primary bg-bg-primary/60 border border-green/30 rounded-lg p-3 max-h-72 overflow-y-auto">
                              {r.response_received}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </>
        )}

        {/* ── Admin changes tab ── */}
        {tab === 'changes' && (
          <>
            {auditLoading && (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            )}
            {!auditLoading && audit.length === 0 && (
              <div className="text-center py-10">
                <ClockIcon className="w-10 h-10 text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-secondary">No admin changes yet.</p>
                <p className="text-xs text-text-muted mt-1">
                  When an admin saves an override, it will be tracked here.
                </p>
              </div>
            )}
            {!auditLoading &&
              audit.map((entry) => {
                const meta = ACTION_META[entry.action];
                const Icon = meta.icon;
                const isOpen = !!expanded[`audit-${entry.id}`];
                return (
                  <div
                    key={`audit-${entry.id}`}
                    className="rounded-xl border border-white/[0.06] bg-bg-card/60 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpand(`audit-${entry.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]"
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 ${meta.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
                          <span className="text-xs text-text-secondary">
                            by {entry.admin || 'system'}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-muted mt-0.5">{fmt(entry.created_at)}</div>
                      </div>
                      <span className="text-[11px] text-text-muted">
                        {isOpen ? 'Hide diff' : 'Show diff'}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 grid md:grid-cols-2 gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                            Previous
                          </div>
                          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-text-secondary bg-bg-primary/60 border border-white/[0.06] rounded-lg p-3 max-h-60 overflow-y-auto">
                            {entry.previous_text || '(empty)'}
                          </pre>
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                            New
                          </div>
                          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-text-primary bg-bg-primary/60 border border-coral/30 rounded-lg p-3 max-h-60 overflow-y-auto">
                            {entry.new_text || '(empty)'}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </>
        )}
      </div>
    </Modal>
  );
}

export default PromptAuditTimeline;
