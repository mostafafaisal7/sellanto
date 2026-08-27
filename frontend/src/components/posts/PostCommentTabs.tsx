/**
 * PostCommentTabs — read and reply to a post's comments, one tab per platform.
 *
 * SellAnto only has comment code for Facebook and Instagram, so a tab appears
 * for each of those the post actually reached. Each tab fetches and replies
 * against that platform alone (`?platform=`), because a post published to both
 * has two separate comment threads that must not be mixed.
 *
 * Hide and delete are Instagram-only. Both are granted by
 * instagram_manage_comments; the Facebook equivalents need
 * pages_manage_engagement, which this app does not request, so those controls
 * are not offered on the Facebook tab rather than being shown and always
 * failing.
 *
 * Deliberately shows an empty state rather than sample data: this renders real
 * comments from a real account, and filling it with placeholders would put
 * words in strangers' mouths.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  EyeSlashIcon,
  EyeIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { Button, PlatformIcon, platformNames, HelpButton } from '../ui';
import api from '../../services/api';
import type { Post, PlatformType } from '../../types';

/** Platforms the backend can read and reply to comments on. */
const COMMENT_PLATFORMS: PlatformType[] = ['facebook', 'instagram'] as PlatformType[];

interface PostComment {
  id: number;
  platform: string;
  author_name: string;
  body: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  created_at: string;
  reply_body: string | null;
  reply_type: 'human' | 'ai' | null;
  replied_at: string | null;
  is_hidden: boolean;
}

const sentimentStyles: Record<string, string> = {
  positive: 'bg-green-500/10 text-green-400',
  negative: 'bg-red-500/10 text-red-400',
  neutral: 'bg-white/5 text-text-muted',
};

function errorText(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: Record<string, unknown> } }).response?.data;
    for (const key of ['error', 'detail', 'message']) {
      const value = data?.[key];
      if (typeof value === 'string' && value) return value;
    }
  }
  return fallback;
}

export function PostCommentTabs({ post }: { post: Post }) {
  // Only platforms this post actually published to can have comments — the
  // post id is what the backend reads the thread from.
  const available = COMMENT_PLATFORMS.filter(
    (p) => !!(post as unknown as Record<string, string | undefined>)[`${p}_post_id`]
  );

  const [active, setActive] = useState<PlatformType | null>(available[0] ?? null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  // Deleting destroys someone else's words on Instagram and cannot be undone,
  // so it is confirmed in-row. An overlay modal is avoided here because this
  // component already renders inside the post detail modal.
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  // Admin switch. Assumed on until told otherwise so the control does not
  // flicker out on a slow read; the backend refuses the action regardless.
  const [canHide, setCanHide] = useState(true);

  const load = useCallback(async (platform: PlatformType) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PostComment[]>(
        `/posts/${post.id}/comments/`, { params: { platform } }
      );
      setComments(Array.isArray(res.data) ? res.data : []);
    } catch (err: unknown) {
      setComments([]);
      setError(errorText(err, `Could not load ${platformNames[platform] || platform} comments.`));
    } finally {
      setLoading(false);
    }
  }, [post.id]);

  useEffect(() => {
    if (active) load(active);
  }, [active, load]);

  useEffect(() => {
    api.get<{ instagram_comment_hide_enabled?: boolean }>('/features/')
      .then((res) => setCanHide(res.data?.instagram_comment_hide_enabled !== false))
      .catch(() => undefined);  // leave Hide offered; the backend still gates it
  }, []);

  const sendReply = async (commentId: number) => {
    const text = replyText.trim();
    if (!text) return;
    setBusyId(commentId);
    setError(null);
    try {
      const res = await api.post<{ reply_body?: string }>(
        `/comments/${commentId}/reply/`, { reply_body: text }
      );
      setComments((prev) => prev.map((c) => c.id === commentId
        ? {
            ...c,
            reply_body: res.data?.reply_body || text,
            reply_type: 'human',
            replied_at: new Date().toISOString(),
          }
        : c));
      setReplyFor(null);
      setReplyText('');
    } catch (err: unknown) {
      // The reply never reached the platform, so the comment is left showing
      // as unanswered rather than optimistically marked replied.
      setError(errorText(err, 'Could not send the reply.'));
    } finally {
      setBusyId(null);
    }
  };

  const draftAiReply = async (commentId: number) => {
    setBusyId(commentId);
    setError(null);
    try {
      const res = await api.post<{ reply_body?: string }>(`/comments/${commentId}/ai-reply/`);
      // Drops the suggestion into the box instead of publishing it — the user
      // still decides whether it goes out under their brand's name.
      setReplyFor(commentId);
      setReplyText(res.data?.reply_body || '');
    } catch (err: unknown) {
      setError(errorText(err, 'Could not generate a reply.'));
    } finally {
      setBusyId(null);
    }
  };

  const toggleHidden = async (comment: PostComment) => {
    setBusyId(comment.id);
    setError(null);
    try {
      const next = !comment.is_hidden;
      await api.post(`/comments/${comment.id}/hide/`, { hidden: next });
      setComments((prev) => prev.map((c) =>
        c.id === comment.id ? { ...c, is_hidden: next } : c));
    } catch (err: unknown) {
      // Instagram still holds whatever state it had, so the row is left as-is
      // instead of showing a change that did not happen.
      setError(errorText(err, 'Could not update the comment on Instagram.'));
    } finally {
      setBusyId(null);
    }
  };

  const deleteComment = async (commentId: number) => {
    setBusyId(commentId);
    setError(null);
    try {
      await api.delete(`/comments/${commentId}/delete/`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setConfirmDeleteId(null);
    } catch (err: unknown) {
      setError(errorText(err, 'Could not delete the comment on Instagram.'));
    } finally {
      setBusyId(null);
    }
  };

  if (available.length === 0) {
    return (
      <div className="border-t border-white/8 pt-5">
        <p className="text-sm text-text-muted">
          Comments appear here once this post is published to Facebook or Instagram.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-white/8 pt-5 space-y-4">
      <div className="flex items-center gap-2">
        <ChatBubbleLeftRightIcon className="w-5 h-5 text-coral" />
        <h3 className="text-sm font-semibold text-text-primary">Comments</h3>
      </div>

      {/* One tab per platform this post reached. */}
      <div className="flex items-center gap-2 border-b border-white/8">
        {available.map((platform) => {
          const isActive = platform === active;
          return (
            <button
              key={platform}
              type="button"
              onClick={() => { setActive(platform); setReplyFor(null); setReplyText(''); }}
              className={`flex items-center gap-2 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-coral text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <PlatformIcon platform={platform} size="sm" />
              {platformNames[platform] || platform}
            </button>
          );
        })}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          disabled={loading || !active}
          leftIcon={<ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
          onClick={() => active && load(active)}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-lg p-3">
          <ExclamationCircleIcon className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <p className="text-xs text-danger">{error}</p>
        </div>
      )}

      {loading && <p className="text-sm text-text-muted">Loading comments…</p>}

      {!loading && comments.length === 0 && !error && (
        <p className="text-sm text-text-muted">
          No comments on {active ? platformNames[active] || active : 'this platform'} yet.
        </p>
      )}

      <div className="space-y-3">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className={`rounded-xl p-3 space-y-2 ${
              comment.is_hidden
                ? 'bg-dark-700/20 border border-dashed border-white/10'
                : 'bg-dark-700/40'
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-text-primary">{comment.author_name}</span>
              {comment.is_hidden && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                  Hidden on Instagram
                </span>
              )}
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${sentimentStyles[comment.sentiment] || sentimentStyles.neutral}`}>
                {comment.sentiment}
              </span>
              {comment.created_at && (
                <span className="text-[11px] text-text-muted">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
              )}
            </div>
            <p className="text-sm text-text-secondary">{comment.body}</p>

            {comment.reply_body ? (
              <div className="flex items-start gap-2 pl-3 border-l-2 border-coral/40">
                <CheckCircleIcon className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-text-secondary">{comment.reply_body}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Replied{comment.reply_type === 'ai' ? ' with AI' : ''}
                  </p>
                </div>
              </div>
            ) : replyFor === comment.id ? (
              <div className="space-y-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={2}
                  autoFocus
                  placeholder={`Reply on ${active ? platformNames[active] || active : ''}…`}
                  className="w-full text-sm rounded-lg bg-dark-900 border border-white/10 p-2 text-text-primary focus:outline-none focus:border-coral"
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    isLoading={busyId === comment.id}
                    disabled={!replyText.trim()}
                    leftIcon={<PaperAirplaneIcon className="w-4 h-4" />}
                    onClick={() => sendReply(comment.id)}
                  >
                    Send reply
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setReplyFor(null); setReplyText(''); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Replying and moderation share one row so each comment stays
                compact. Delete still confirms first -- it destroys someone
                else's words on Instagram and cannot be undone -- but inline,
                replacing the row rather than adding one. */}
            {confirmDeleteId === comment.id ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-danger">
                  Delete permanently? Hiding keeps it recoverable.
                </span>
                <Button
                  size="sm"
                  className="bg-danger hover:bg-danger/80"
                  isLoading={busyId === comment.id}
                  onClick={() => deleteComment(comment.id)}
                >
                  Delete
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDeleteId(null)}
                >
                  Keep
                </Button>
              </div>
            ) : replyFor === comment.id ? null : (
              <div className="flex items-center gap-1 flex-wrap">
                {!comment.reply_body && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setReplyFor(comment.id); setReplyText(''); }}
                    >
                      Reply
                    </Button>
                    <HelpButton
                      title="Reply"
                      body={<>Posts a <strong>public reply</strong> under this comment as your{' '}
                        {active ? platformNames[active] || active : ''} account.</>}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      isLoading={busyId === comment.id}
                      leftIcon={<SparklesIcon className="w-4 h-4" />}
                      onClick={() => draftAiReply(comment.id)}
                    >
                      Draft with AI
                    </Button>
                    <HelpButton
                      title="Draft with AI"
                      body={<>Suggests a reply in the box below. <strong>Nothing is posted</strong>{' '}
                        until you press Send reply.</>}
                    />
                  </>
                )}
                {/* Instagram only — see the note at the top of the file. */}
                {active === 'instagram' && (
                  <>
                    {/* Unhide stays available when the admin switch is off,
                        so a comment hidden earlier is never stuck. */}
                    {(canHide || comment.is_hidden) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        isLoading={busyId === comment.id}
                        leftIcon={comment.is_hidden
                          ? <EyeIcon className="w-4 h-4" />
                          : <EyeSlashIcon className="w-4 h-4" />}
                        onClick={() => toggleHidden(comment)}
                        title={comment.is_hidden
                          ? 'Show this comment on Instagram again'
                          : 'Hide this comment from everyone except you — reversible'}
                      >
                        {comment.is_hidden ? 'Unhide' : 'Hide'}
                      </Button>
                    )}
                    {(canHide || comment.is_hidden) && (
                      <HelpButton
                        title={comment.is_hidden ? 'Unhide' : 'Hide'}
                        body={comment.is_hidden
                          ? <>Makes this comment <strong>visible on Instagram</strong> again.</>
                          : <>Hides this comment on Instagram. You can{' '}
                              <strong>unhide it any time</strong>.</>}
                      />
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger hover:bg-danger/10"
                      leftIcon={<TrashIcon className="w-4 h-4" />}
                      onClick={() => setConfirmDeleteId(comment.id)}
                      title="Permanently delete this comment from Instagram"
                    >
                      Delete
                    </Button>
                    <HelpButton
                      title="Delete"
                      body={<>Deletes this comment from Instagram, <strong>for everyone</strong>.</>}
                      warning={<><strong>Cannot be undone.</strong> Hiding keeps it recoverable.</>}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PostCommentTabs;
