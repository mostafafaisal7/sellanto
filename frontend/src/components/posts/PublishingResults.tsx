/**
 * PublishingResults
 * ─────────────────
 * Per-platform outcome list shown in the post detail drawer.
 *
 * Renders four distinct states rather than a success/failure binary. A post
 * that has not been attempted yet has no post_id and no error, which the old
 * `result.success ? … : 'Failed to publish'` markup rendered as a failure —
 * so a perfectly healthy scheduled post looked broken.
 *
 * The failure row shows the real reason from the backend when there is one,
 * and says plainly that no reason was recorded when there isn't, instead of
 * the uninformative "Failed to publish".
 */
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import type { PlatformResult } from '../../types';

interface Props {
  results: PlatformResult[];
  /** Post-level status, used to describe *why* something is still pending. */
  postStatus?: string;
}

type State = 'published' | 'failed' | 'pending' | 'publishing';

/** Fall back to the old derivation for responses that predate the `state` field. */
function resolveState(r: PlatformResult): State {
  if (r.state) return r.state;
  if (r.success) return 'published';
  return r.error ? 'failed' : 'pending';
}

const STYLES: Record<State, { box: string; text: string; Icon: typeof CheckCircleIcon }> = {
  published:  { box: 'bg-success/10 border-success/20', text: 'text-success',     Icon: CheckCircleIcon },
  failed:     { box: 'bg-danger/10 border-danger/20',   text: 'text-danger',      Icon: XCircleIcon },
  pending:    { box: 'bg-white/5 border-white/10',      text: 'text-text-muted',  Icon: ClockIcon },
  publishing: { box: 'bg-primary/10 border-primary/20', text: 'text-primary',     Icon: ArrowPathIcon },
};

function describe(state: State, r: PlatformResult, postStatus?: string): string {
  switch (state) {
    case 'published':
      return 'Published successfully';
    case 'failed':
      return r.error || 'Failed to publish — no reason was recorded. Check the server logs.';
    case 'publishing':
      return 'Publishing now…';
    case 'pending':
    default:
      if (postStatus === 'draft') return 'Not published yet — this post is still a draft.';
      if (postStatus === 'pending_approval') return 'Waiting for approval before publishing.';
      return 'Waiting to publish at the scheduled time.';
  }
}

export function PublishingResults({ results, postStatus }: Props) {
  if (!results || results.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-medium text-text-secondary mb-2">Publishing Results</h4>
      <div className="space-y-2">
        {results.map((result, i) => {
          const state = resolveState(result);
          const { box, text, Icon } = STYLES[state];
          return (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${box}`}>
              <Icon
                className={`w-5 h-5 flex-shrink-0 mt-0.5 ${text} ${
                  state === 'publishing' ? 'animate-spin' : ''
                }`}
              />
              <div className="min-w-0">
                <span className="text-sm capitalize font-medium">{result.platform}</span>
                <p className={`text-sm ${text} break-words`}>
                  {describe(state, result, postStatus)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PublishingResults;
