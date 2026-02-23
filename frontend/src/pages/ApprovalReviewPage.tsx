import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircleIcon, XCircleIcon, ArrowPathIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import approvalService from '../services/approvalService';

interface PendingPost {
  id: number;
  caption: string;
  platforms: string[];
  status: string;
  brand_name: string;
  pillar_name: string;
  hook: string;
  format_type: string;
  submitted_at: string;
  checklist_status: Record<string, boolean>;
  captions: Array<{ id: number; platform: string; body: string; is_selected: boolean }>;
  hashtags: Array<{ id: number; tag: string; tier: string; is_selected: boolean }>;
}

interface ApprovalLogEntry {
  id: number;
  action: string;
  acted_by_username: string;
  comment: string;
  rejection_reason: string;
  created_at: string;
}

export function ApprovalReviewPage() {
  const [pending, setPending] = useState<PendingPost[]>([]);
  const [selected, setSelected] = useState<PendingPost | null>(null);
  const [approvalLog, setApprovalLog] = useState<ApprovalLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Action form
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showChangesForm, setShowChangesForm] = useState(false);
  const [comment, setComment] = useState('');
  const [rejectionReason, setRejectionReason] = useState('quality');

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    setLoading(true);
    try {
      const data = await approvalService.getPending();
      setPending(data);
      if (data.length > 0 && !selected) {
        selectPost(data[0]);
      }
    } catch (err) {
      console.error('Failed to load pending:', err);
    }
    setLoading(false);
  };

  const selectPost = async (post: PendingPost) => {
    setSelected(post);
    try {
      const log = await approvalService.getApprovalLog(post.id);
      setApprovalLog(log);
    } catch {
      setApprovalLog([]);
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await approvalService.approve(selected.id, comment);
      setComment('');
      setPending(pending.filter(p => p.id !== selected.id));
      setSelected(null);
      loadPending();
    } catch (err) {
      console.error('Failed to approve:', err);
    }
    setActionLoading(false);
  };

  const handleRequestChanges = async () => {
    if (!selected || !comment) return;
    setActionLoading(true);
    try {
      await approvalService.requestChanges(selected.id, comment);
      setComment('');
      setShowChangesForm(false);
      loadPending();
    } catch (err) {
      console.error('Failed to request changes:', err);
    }
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await approvalService.reject(selected.id, rejectionReason, comment);
      setComment('');
      setShowRejectForm(false);
      loadPending();
    } catch (err) {
      console.error('Failed to reject:', err);
    }
    setActionLoading(false);
  };

  const actionColors: Record<string, string> = {
    submitted: 'text-blue-400',
    approved: 'text-green-400',
    changes_requested: 'text-yellow-400',
    rejected: 'text-red-400',
    escalated: 'text-orange-400',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Approval Queue</h1>
        <p className="text-text-secondary mt-1">{pending.length} post(s) pending review</p>
      </div>

      {pending.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircleIcon className="w-12 h-12 mx-auto text-green-400 mb-3" />
          <p className="text-lg font-medium">All caught up!</p>
          <p className="text-text-secondary mt-1">No posts pending approval</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Post List */}
          <div className="space-y-2">
            {pending.map((post) => (
              <button
                key={post.id}
                onClick={() => selectPost(post)}
                className={`card p-3 w-full text-left transition-colors ${
                  selected?.id === post.id ? 'ring-2 ring-primary-500' : ''
                }`}
              >
                <p className="text-sm font-medium line-clamp-2">{post.caption || post.hook || 'Untitled Draft'}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-text-secondary">
                  {post.brand_name && <span>{post.brand_name}</span>}
                  <span>·</span>
                  <ClockIcon className="w-3 h-3" />
                  <span>{new Date(post.submitted_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Post Detail */}
          {selected && (
            <div className="lg:col-span-2 space-y-4">
              {/* Preview Card */}
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  {selected.pillar_name && <span className="badge badge-primary text-xs">{selected.pillar_name}</span>}
                  {selected.format_type && <span className="badge text-xs">{selected.format_type}</span>}
                  {selected.platforms?.map((p) => (
                    <span key={p} className="badge text-xs capitalize">{p}</span>
                  ))}
                </div>

                {selected.hook && (
                  <p className="text-primary-400 font-medium mb-2">Hook: {selected.hook}</p>
                )}

                <div className="prose prose-invert prose-sm max-w-none">
                  <p>{selected.caption}</p>
                </div>

                {/* Captions */}
                {selected.captions?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <h4 className="text-sm font-semibold mb-2">Caption Variants</h4>
                    {selected.captions.filter(c => c.is_selected).map((c) => (
                      <div key={c.id} className="bg-dark-700/50 rounded p-3 mb-2">
                        <span className="badge text-xs mb-1">{c.platform}</span>
                        <p className="text-sm">{c.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Hashtags */}
                {selected.hashtags?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <h4 className="text-sm font-semibold mb-2">Hashtags</h4>
                    <div className="flex flex-wrap gap-1">
                      {selected.hashtags.filter(h => h.is_selected).map((h) => (
                        <span key={h.id} className="text-xs bg-primary-500/10 text-primary-400 px-2 py-0.5 rounded">
                          #{h.tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Checklist */}
                {selected.checklist_status && Object.keys(selected.checklist_status).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <h4 className="text-sm font-semibold mb-2">Checklist</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(selected.checklist_status).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2 text-sm">
                          <div className={`w-2 h-2 rounded-full ${val ? 'bg-green-400' : 'bg-red-400'}`} />
                          <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button onClick={handleApprove} disabled={actionLoading} className="btn-primary flex items-center gap-2 flex-1">
                  <CheckCircleIcon className="w-5 h-5" /> Approve
                </button>
                <button onClick={() => { setShowChangesForm(true); setShowRejectForm(false); }} className="btn-secondary flex items-center gap-2 flex-1">
                  <ArrowPathIcon className="w-5 h-5" /> Request Changes
                </button>
                <button onClick={() => { setShowRejectForm(true); setShowChangesForm(false); }} className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-4 py-2 rounded-lg flex items-center gap-2 flex-1 justify-center transition-colors">
                  <XCircleIcon className="w-5 h-5" /> Reject
                </button>
              </div>

              {/* Changes Form */}
              {showChangesForm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="card p-4">
                  <h4 className="text-sm font-semibold mb-2">Request Changes</h4>
                  <textarea className="input w-full" rows={3} placeholder="Describe the changes needed..." value={comment} onChange={(e) => setComment(e.target.value)} />
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setShowChangesForm(false)} className="btn-secondary">Cancel</button>
                    <button onClick={handleRequestChanges} disabled={!comment || actionLoading} className="btn-primary">Submit</button>
                  </div>
                </motion.div>
              )}

              {/* Reject Form */}
              {showRejectForm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="card p-4">
                  <h4 className="text-sm font-semibold mb-2">Reject Post</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Reason</label>
                      <select className="input w-full" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}>
                        <option value="off_brand">Off Brand</option>
                        <option value="compliance_issue">Compliance Issue</option>
                        <option value="quality">Quality</option>
                        <option value="factual_error">Factual Error</option>
                        <option value="timing">Timing</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <textarea className="input w-full" rows={2} placeholder="Additional comment..." value={comment} onChange={(e) => setComment(e.target.value)} />
                    <div className="flex gap-2">
                      <button onClick={() => setShowRejectForm(false)} className="btn-secondary">Cancel</button>
                      <button onClick={handleReject} disabled={actionLoading} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors">Reject</button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Approval History */}
              {approvalLog.length > 0 && (
                <div className="card p-4">
                  <h4 className="text-sm font-semibold mb-3">Approval History</h4>
                  <div className="space-y-3">
                    {approvalLog.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 ${
                          entry.action === 'approved' ? 'bg-green-400' :
                          entry.action === 'rejected' ? 'bg-red-400' :
                          entry.action === 'changes_requested' ? 'bg-yellow-400' : 'bg-blue-400'
                        }`} />
                        <div>
                          <p className="text-sm">
                            <span className="font-medium">{entry.acted_by_username}</span>{' '}
                            <span className={actionColors[entry.action] || ''}>{entry.action.replace(/_/g, ' ')}</span>
                          </p>
                          {entry.comment && <p className="text-xs text-text-secondary mt-0.5">{entry.comment}</p>}
                          <p className="text-xs text-text-secondary">{new Date(entry.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ApprovalReviewPage;
