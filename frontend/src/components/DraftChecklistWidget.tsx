import { useState, useEffect } from 'react';
import {
  CheckCircleIcon, XCircleIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import approvalService from '../services/approvalService';

interface Props {
  postId: number;
  onSubmit?: () => void;
}

interface ChecklistData {
  post_id: number;
  checklist: Record<string, boolean>;
  is_complete: boolean;
}

const CHECKLIST_LABELS: Record<string, string> = {
  caption: 'Caption Selected',
  hashtags: 'Hashtags Added',
  creative: 'Creative Asset',
  alt_text: 'Alt Text',
  platform_mapping: 'Platform Mapped',
};

export function DraftChecklistWidget({ postId, onSubmit }: Props) {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChecklist();
  }, [postId]);

  const loadChecklist = async () => {
    try {
      const result = await approvalService.getChecklist(postId);
      setData(result);
    } catch (err) {
      console.error('Failed to load checklist:', err);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!data?.is_complete) return;
    try {
      await approvalService.submitForApproval(postId);
      onSubmit?.();
    } catch (err) {
      console.error('Failed to submit:', err);
    }
  };

  if (loading) {
    return (
      <div className="card p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-dark-700 rounded w-3/4" />
          <div className="h-3 bg-dark-700 rounded w-1/2" />
          <div className="h-3 bg-dark-700 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const completed = Object.values(data.checklist).filter(Boolean).length;
  const total = Object.keys(data.checklist).length;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2 text-sm">
          <ClipboardDocumentCheckIcon className="w-4 h-4 text-primary-400" />
          Draft Checklist
        </h4>
        <span className={`text-xs font-medium ${data.is_complete ? 'text-green-400' : 'text-yellow-400'}`}>
          {completed}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${data.is_complete ? 'bg-green-500' : 'bg-yellow-500'}`}
          style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
        />
      </div>

      {/* Checklist items */}
      <div className="space-y-1.5">
        {Object.entries(data.checklist).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2 text-sm">
            {value ? (
              <CheckCircleIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
            ) : (
              <XCircleIcon className="w-4 h-4 text-red-400 flex-shrink-0" />
            )}
            <span className={value ? 'text-text-primary' : 'text-text-secondary'}>
              {CHECKLIST_LABELS[key] || key.replace(/_/g, ' ')}
            </span>
          </div>
        ))}
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!data.is_complete}
        className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
          data.is_complete
            ? 'btn-primary'
            : 'bg-dark-700 text-text-secondary cursor-not-allowed'
        }`}
      >
        {data.is_complete ? 'Submit for Approval' : 'Complete checklist to submit'}
      </button>
    </div>
  );
}

export default DraftChecklistWidget;
