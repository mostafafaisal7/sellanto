import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  PaperAirplaneIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FaceSmileIcon,
  FaceFrownIcon,
  MinusCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';

interface Comment {
  id: number;
  author_name: string;
  author_avatar?: string;
  body: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  created_at: string;
  reply_body?: string;
  reply_type?: 'human' | 'ai' | null;
  replied_at?: string;
}

interface Props {
  postId: number;
}

type FilterTab = 'all' | 'positive' | 'negative' | 'unreplied';

const SENTIMENT_CONFIG: Record<
  string,
  { icon: typeof FaceSmileIcon; bg: string; text: string; label: string }
> = {
  positive: {
    icon: FaceSmileIcon,
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    label: 'Positive',
  },
  neutral: {
    icon: MinusCircleIcon,
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    label: 'Neutral',
  },
  negative: {
    icon: FaceFrownIcon,
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    label: 'Negative',
  },
};

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'positive', label: 'Positive' },
  { id: 'negative', label: 'Negative' },
  { id: 'unreplied', label: 'Unreplied' },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function PostCommentInbox({ postId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [expandedReply, setExpandedReply] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState<number | null>(null);
  const [generatingAI, setGeneratingAI] = useState<number | null>(null);

  useEffect(() => {
    loadComments();
  }, [postId]);

  const loadComments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/posts/${postId}/comments/`);
      setComments(res.data);
    } catch (err) {
      console.error('Failed to load comments:', err);
      setError('Failed to load comments');
    }
    setLoading(false);
  };

  const handleSendReply = async (commentId: number) => {
    if (!replyText.trim()) return;
    setSendingReply(commentId);
    try {
      const res = await api.post(`/comments/${commentId}/reply/`, {
        reply_body: replyText.trim(),
        reply_type: 'human',
      });
      setComments(
        comments.map((c) =>
          c.id === commentId
            ? {
                ...c,
                reply_body: res.data.reply_body || replyText.trim(),
                reply_type: 'human',
                replied_at: new Date().toISOString(),
              }
            : c
        )
      );
      setExpandedReply(null);
      setReplyText('');
    } catch (err) {
      console.error('Failed to send reply:', err);
    }
    setSendingReply(null);
  };

  const handleAIReply = async (commentId: number) => {
    setGeneratingAI(commentId);
    try {
      const res = await api.post(`/comments/${commentId}/ai-reply/`);
      setComments(
        comments.map((c) =>
          c.id === commentId
            ? {
                ...c,
                reply_body: res.data.reply_body,
                reply_type: 'ai',
                replied_at: new Date().toISOString(),
              }
            : c
        )
      );
      setExpandedReply(null);
      setReplyText('');
    } catch (err) {
      console.error('Failed to generate AI reply:', err);
    }
    setGeneratingAI(null);
  };

  const filteredComments = comments.filter((c) => {
    switch (activeFilter) {
      case 'positive':
        return c.sentiment === 'positive';
      case 'negative':
        return c.sentiment === 'negative';
      case 'unreplied':
        return !c.reply_body;
      default:
        return true;
    }
  });

  const sentimentCounts = {
    all: comments.length,
    positive: comments.filter((c) => c.sentiment === 'positive').length,
    negative: comments.filter((c) => c.sentiment === 'negative').length,
    unreplied: comments.filter((c) => !c.reply_body).length,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-800 border border-white/10 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <ChatBubbleLeftRightIcon className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary text-sm">
              Comment Inbox
            </h3>
            <p className="text-xs text-text-muted">
              {comments.length} comment{comments.length !== 1 ? 's' : ''} &middot;{' '}
              {sentimentCounts.unreplied} unreplied
            </p>
          </div>
        </div>
        <button
          onClick={loadComments}
          className="p-1.5 rounded-lg hover:bg-white/5 text-text-secondary transition-colors"
          title="Refresh"
        >
          <ArrowPathIcon
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-white/10">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeFilter === tab.id
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
            <span
              className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                activeFilter === tab.id
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'bg-dark-700 text-text-muted'
              }`}
            >
              {sentimentCounts[tab.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Comment List */}
      <div className="max-h-[600px] overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mb-3" />
            <p className="text-sm text-text-secondary">Loading comments...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <ExclamationTriangleIcon className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={loadComments}
              className="mt-3 text-xs text-primary-400 hover:text-primary-300"
            >
              Try again
            </button>
          </div>
        ) : filteredComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <ChatBubbleLeftRightIcon className="w-8 h-8 text-text-muted mb-2" />
            <p className="text-sm text-text-secondary">
              {activeFilter === 'all'
                ? 'No comments yet'
                : `No ${activeFilter} comments`}
            </p>
          </div>
        ) : (
          <div>
            {filteredComments.map((comment, idx) => {
              const sentiment = SENTIMENT_CONFIG[comment.sentiment] || SENTIMENT_CONFIG.neutral;
              const SentimentIcon = sentiment.icon;
              const isExpanded = expandedReply === comment.id;
              const isSending = sendingReply === comment.id;
              const isGenerating = generatingAI === comment.id;

              return (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  className="border-b border-white/5 last:border-b-0"
                >
                  {/* Comment */}
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      {comment.author_avatar ? (
                        <img
                          src={comment.author_avatar}
                          alt={comment.author_name}
                          className="w-8 h-8 rounded-full flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-text-secondary">
                            {getInitials(comment.author_name)}
                          </span>
                        </div>
                      )}

                      {/* Body */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-text-primary">
                            {comment.author_name}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${sentiment.bg} ${sentiment.text}`}
                          >
                            <SentimentIcon className="w-3 h-3" />
                            {sentiment.label}
                          </span>
                          <span className="text-[11px] text-text-muted">
                            {timeAgo(comment.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                          {comment.body}
                        </p>

                        {/* Existing Reply */}
                        {comment.reply_body && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-3 pl-3 border-l-2 border-primary-500/30"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <CheckBadgeIcon className="w-3.5 h-3.5 text-primary-400" />
                              <span className="text-[10px] font-medium text-text-muted">
                                Replied
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                  comment.reply_type === 'ai'
                                    ? 'bg-purple-500/10 text-purple-400'
                                    : 'bg-blue-500/10 text-blue-400'
                                }`}
                              >
                                {comment.reply_type === 'ai' ? 'AI' : 'Human'}
                              </span>
                            </div>
                            <p className="text-xs text-text-secondary leading-relaxed">
                              {comment.reply_body}
                            </p>
                          </motion.div>
                        )}

                        {/* Action Buttons */}
                        {!comment.reply_body && (
                          <div className="flex items-center gap-2 mt-3">
                            <button
                              onClick={() => {
                                if (isExpanded) {
                                  setExpandedReply(null);
                                  setReplyText('');
                                } else {
                                  setExpandedReply(comment.id);
                                  setReplyText('');
                                }
                              }}
                              className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-dark-700 text-text-secondary hover:text-text-primary transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronUpIcon className="w-3 h-3" />
                              ) : (
                                <ChevronDownIcon className="w-3 h-3" />
                              )}
                              Reply
                            </button>
                            <button
                              onClick={() => handleAIReply(comment.id)}
                              disabled={isGenerating}
                              className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                            >
                              {isGenerating ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-400" />
                              ) : (
                                <SparklesIcon className="w-3 h-3" />
                              )}
                              AI Reply
                            </button>
                          </div>
                        )}

                        {/* Reply Input */}
                        <AnimatePresence>
                          {isExpanded && !comment.reply_body && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-3 overflow-hidden"
                            >
                              <div className="bg-dark-700/50 rounded-lg p-3">
                                <textarea
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder="Write your reply..."
                                  rows={3}
                                  className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
                                  autoFocus
                                />
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-[10px] text-text-muted">
                                    {replyText.length} characters
                                  </span>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        setExpandedReply(null);
                                        setReplyText('');
                                      }}
                                      className="text-xs px-3 py-1.5 rounded-lg bg-dark-700 text-text-secondary hover:text-text-primary transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleSendReply(comment.id)
                                      }
                                      disabled={
                                        !replyText.trim() || isSending
                                      }
                                      className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {isSending ? (
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                                      ) : (
                                        <PaperAirplaneIcon className="w-3 h-3" />
                                      )}
                                      Send
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {!loading && comments.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-dark-700/30">
          <div className="flex items-center gap-4">
            {Object.entries(SENTIMENT_CONFIG).map(([key, config]) => {
              const count = comments.filter((c) => c.sentiment === key).length;
              const Icon = config.icon;
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${config.text}`} />
                  <span className="text-[10px] text-text-muted">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
          <span className="text-[10px] text-text-muted">
            {comments.filter((c) => c.reply_body).length}/{comments.length}{' '}
            replied
          </span>
        </div>
      )}
    </motion.div>
  );
}

export default PostCommentInbox;
