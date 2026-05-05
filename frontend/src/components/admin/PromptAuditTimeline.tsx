import { useEffect, useState } from 'react';
import {
  ClockIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { Modal, Spinner } from '../ui';
import {
  adminPromptService,
  type AuditEntry,
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

export function PromptAuditTimeline({
  open,
  userId,
  promptType,
  promptDisplayName,
  onClose,
}: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!open || !promptType) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExpanded({});
    adminPromptService
      .audit(userId, promptType)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load audit log');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId, promptType]);

  return (
    <Modal isOpen={open} onClose={onClose} size="xl" title={`Change history · ${promptDisplayName}`}>
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        )}
        {error && (
          <div className="text-xs text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-10">
            <ClockIcon className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-secondary">No changes yet.</p>
          </div>
        )}
        {entries.map((entry) => {
          const meta = ACTION_META[entry.action];
          const Icon = meta.icon;
          const isOpen = !!expanded[entry.id];
          return (
            <div
              key={entry.id}
              className="rounded-xl border border-white/[0.06] bg-bg-card/60 overflow-hidden"
            >
              <button
                type="button"
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))
                }
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]"
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${meta.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold ${meta.color}`}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-text-secondary">
                      by {entry.admin || 'system'}
                    </span>
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    {fmt(entry.created_at)}
                  </div>
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
      </div>
    </Modal>
  );
}

export default PromptAuditTimeline;
