import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  FunnelIcon,
  DocumentTextIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  TrashIcon,
  PencilIcon,
  XMarkIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  SparklesIcon,
  RocketLaunchIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { BoostPostModal } from '../components/ads/BoostPostModal';
import { BoostFromContentModal } from '../components/ads/BoostFromContentModal';
import { format, formatDistanceToNow } from 'date-fns';
import { Button, Card, StatusBadge, PlatformBadge, Modal, ConfirmModal, LoadingPlaceholder, platformNames, HelpButton } from '../components/ui';
import { postService } from '../services';
import { describeDestinations } from '../utils/platformDestinations';
import { PublishingResults } from '../components/posts/PublishingResults';
import { PostCommentTabs } from '../components/posts/PostCommentTabs';
import { usePostStore } from '../store';
import type { Post, PostStatus, PlatformLink } from '../types';

const statusFilters: { value: PostStatus | 'all'; label: string; icon: typeof DocumentTextIcon; color: string }[] = [
  { value: 'all', label: 'All', icon: DocumentTextIcon, color: 'text-text-primary' },
  { value: 'scheduled', label: 'Scheduled', icon: ClockIcon, color: 'text-info' },
  { value: 'posted', label: 'Posted', icon: CheckCircleIcon, color: 'text-success' },
  { value: 'failed', label: 'Failed', icon: XCircleIcon, color: 'text-danger' },
];

export function MyPostsPage() {
  const { posts, totalCount, isLoading, statusFilter, fetchPosts, setStatusFilter, deletePost, cancelPost } = usePostStore();
  const [searchParams] = useSearchParams();
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [boostingPost, setBoostingPost] = useState<Post | null>(null);
  const [boostContentOpen, setBoostContentOpen] = useState(false);
  const [deleteModalPost, setDeleteModalPost] = useState<Post | null>(null);
  const [cancelModalPost, setCancelModalPost] = useState<Post | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [postLinks, setPostLinks] = useState<Record<number, PlatformLink[]>>({});
  const [_viewMode, _setViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    const statusParam = searchParams.get('status') as PostStatus | null;
    if (statusParam && statusParam !== statusFilter) {
      setStatusFilter(statusParam);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Resolve each published post's public URL so the row can link straight to
  // it. Facebook and Instagram permalinks need a Graph lookup, so this is one
  // request per post — the backend caches each for a day, and only posts that
  // actually reached a platform are asked about. A post whose lookup fails is
  // recorded as an empty list so it is not retried on every render.
  useEffect(() => {
    const pending = posts.filter(
      (p) => p.status === 'posted' && postLinks[p.id] === undefined
    );
    if (pending.length === 0) return;

    let cancelled = false;
    Promise.all(
      pending.map((p) =>
        postService
          .getLinks(p.id)
          .then((links) => [p.id, links] as const)
          .catch(() => [p.id, [] as PlatformLink[]] as const)
      )
    ).then((entries) => {
      if (!cancelled) {
        setPostLinks((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [posts, postLinks]);

  // Deleting only reaches Facebook and Instagram: PostViewSet.destroy has
  // remote-delete code for those two alone. A post published to any other
  // platform is removed from SellAnto and stays live there, which the help
  // text has to say rather than implying everything is cleaned up.
  const REMOTE_DELETE_PLATFORMS = ['facebook', 'instagram'] as const;

  const deleteHelpBody = (post: Post) => {
    const publishedOn = (p: string) =>
      !!(post as unknown as Record<string, string | undefined>)[`${p}_post_id`];

    const removed = REMOTE_DELETE_PLATFORMS.filter(publishedOn);
    const untouched = (post.platforms as string[])
      .filter((p) => !REMOTE_DELETE_PLATFORMS.includes(p as 'facebook' | 'instagram'))
      .filter(publishedOn);

    return (
      <>
        {removed.length
          ? <>Deletes this post from SellAnto <strong>and from {describeDestinations(removed)}</strong>.</>
          : <>Removes this post from SellAnto. It was <strong>never published</strong>.</>}
        {untouched.length > 0 && (
          <> It <strong>stays live on {describeDestinations(untouched)}</strong> — SellAnto
            only deletes Facebook and Instagram posts.</>
        )}
      </>
    );
  };

  const handleDelete = async () => {
    if (!deleteModalPost) return;
    setIsDeleting(true);
    try {
      await deletePost(deleteModalPost.id);
      setDeleteModalPost(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelModalPost) return;
    setIsCancelling(true);
    try {
      await cancelPost(cancelModalPost.id);
      setCancelModalPost(null);
    } finally {
      setIsCancelling(false);
    }
  };

  const filteredPosts = posts.filter((post) =>
    post.caption.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: totalCount,
    scheduled: posts.filter((p) => p.status === 'scheduled').length,
    posted: posts.filter((p) => p.status === 'posted').length,
    failed: posts.filter((p) => p.status === 'failed').length,
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <DocumentTextIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">My Posts</h1>
            <p className="text-text-secondary">Manage and track your scheduled posts</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            leftIcon={<ArrowPathIcon className="w-5 h-5" />}
            onClick={() => fetchPosts()}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Link to="/posts/create">
            <Button leftIcon={<PlusIcon className="w-5 h-5" />}>New Post</Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Posts', value: stats.total, color: 'from-primary to-secondary', icon: DocumentTextIcon },
          { label: 'Scheduled', value: stats.scheduled, color: 'from-blue-500 to-blue-400', icon: ClockIcon },
          { label: 'Posted', value: stats.posted, color: 'from-green-500 to-green-400', icon: CheckCircleIcon },
          { label: 'Failed', value: stats.failed, color: 'from-red-500 to-red-400', icon: XCircleIcon },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card padding="md" className="relative overflow-hidden group hover:-translate-y-1 transition-transform">
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform`} />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-text-primary">{stat.value}</p>
                  <p className="text-sm text-text-secondary">{stat.label}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} bg-opacity-20 flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5 text-text-primary" />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters & Search */}
      <Card padding="md" className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-dark-700 border border-white/10 rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-5 h-5 text-text-muted hidden lg:block" />
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((filter) => (
                <motion.button
                  key={filter.value}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStatusFilter(filter.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    statusFilter === filter.value
                      ? 'bg-gradient-primary text-white shadow-glow-primary'
                      : 'bg-dark-700 text-text-secondary hover:bg-dark-600 hover:text-text-primary'
                  }`}
                >
                  <filter.icon className="w-4 h-4" />
                  {filter.label}
                  {filter.value !== 'all' && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                      statusFilter === filter.value ? 'bg-white/20' : 'bg-dark-600'
                    }`}>
                      {filter.value === 'scheduled'
                        ? stats.scheduled
                        : filter.value === 'posted'
                        ? stats.posted
                        : stats.failed}
                    </span>
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Posts List */}
      {isLoading && !posts.length ? (
        <LoadingPlaceholder />
      ) : filteredPosts.length === 0 ? (
        <Card padding="lg" className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-dark-600 flex items-center justify-center mx-auto mb-4">
            <DocumentTextIcon className="w-10 h-10 text-text-muted" />
          </div>
          <h3 className="text-xl font-semibold text-text-primary mb-2">
            {searchQuery ? 'No posts found' : 'No Posts Yet'}
          </h3>
          <p className="text-text-secondary mb-6 max-w-md mx-auto">
            {searchQuery
              ? `No posts match "${searchQuery}". Try a different search term.`
              : 'Start by creating your first scheduled post and watch your social media presence grow.'}
          </p>
          {!searchQuery && (
            <Link to="/posts/create">
              <Button leftIcon={<PlusIcon className="w-5 h-5" />}>Create Your First Post</Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filteredPosts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card padding="none" className="overflow-hidden group hover:border-white/20 transition-colors">
                  <div className="flex flex-col lg:flex-row">
                    {/* Media Preview */}
                    {post.media_files.length > 0 && (
                      <div className="lg:w-48 lg:h-auto h-48 flex-shrink-0 bg-dark-700 relative">
                        <img
                          src={post.media_files[0]}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        {post.media_files.length > 1 && (
                          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded-lg text-xs text-white">
                            +{post.media_files.length - 1} more
                          </div>
                        )}
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 p-5">
                      {/* Header */}
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <StatusBadge status={post.status} />
                        <div className="flex items-center gap-2 text-sm text-text-muted">
                          <CalendarIcon className="w-4 h-4" />
                          {post.status === 'posted' && post.posted_at ? (
                            <span>Posted {formatDistanceToNow(new Date(post.posted_at), { addSuffix: true })}</span>
                          ) : (
                            <span>{format(new Date(post.scheduled_time), 'MMM d, yyyy • HH:mm')}</span>
                          )}
                        </div>
                        {post.ai_generated && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                            <SparklesIcon className="w-3 h-3" />
                            AI
                          </span>
                        )}
                      </div>

                      {/* Caption */}
                      <p className="text-text-primary mb-4 line-clamp-2 group-hover:line-clamp-none transition-all">
                        {post.caption}
                      </p>

                      {/* Platforms */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {post.platforms.map((platform) => (
                          <PlatformBadge key={platform} platform={platform} />
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-white/5">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<EyeIcon className="w-4 h-4" />}
                          onClick={() => setSelectedPost(post)}
                        >
                          View
                        </Button>
                        {(postLinks[post.id] || []).map((link) => (
                          <a
                            key={link.platform}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Open this post on ${platformNames[link.platform] || link.platform}`}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<ArrowTopRightOnSquareIcon className="w-4 h-4" />}
                            >
                              {platformNames[link.platform] || link.platform}
                            </Button>
                          </a>
                        ))}
                        {(post.status === 'scheduled' || post.status === 'draft') && (
                          <>
                            <Link to={`/posts/${post.id}/edit`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                leftIcon={<PencilIcon className="w-4 h-4" />}
                              >
                                Edit
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<XMarkIcon className="w-4 h-4" />}
                              onClick={() => setCancelModalPost(post)}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        <div className="flex-1" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger hover:bg-danger/10"
                          leftIcon={<TrashIcon className="w-4 h-4" />}
                          onClick={() => setDeleteModalPost(post)}
                        >
                          Delete
                        </Button>
                        <HelpButton
                          title="Delete"
                          body={deleteHelpBody(post)}
                          warning={<><strong>Cannot be undone.</strong></>}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Post Detail Modal */}
      <Modal isOpen={!!selectedPost} onClose={() => setSelectedPost(null)} title="Post Details" size="xl">
        {selectedPost && (
          <div className="space-y-6">
            {/* Status and time */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-dark-700/50 rounded-xl">
              <StatusBadge status={selectedPost.status} size="lg" />
              <div className="flex-1">
                <p className="text-text-primary font-medium">
                  {selectedPost.status === 'posted'
                    ? `Posted on ${format(new Date(selectedPost.posted_at || selectedPost.scheduled_time), 'MMMM d, yyyy')}`
                    : `Scheduled for ${format(new Date(selectedPost.scheduled_time), 'MMMM d, yyyy')}`}
                </p>
                <p className="text-sm text-text-muted">
                  at {format(new Date(selectedPost.posted_at || selectedPost.scheduled_time), 'HH:mm')} ({selectedPost.timezone || 'UTC'})
                </p>
              </div>
            </div>

            {/* Caption */}
            <div>
              <h4 className="text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
                Caption
                {selectedPost.ai_generated && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                    <SparklesIcon className="w-3 h-3" />
                    AI Generated
                  </span>
                )}
              </h4>
              <div className="p-4 bg-dark-700/50 rounded-xl">
                <p className="text-text-primary whitespace-pre-wrap">{selectedPost.caption}</p>
              </div>
            </div>

            {/* Media */}
            {selectedPost.media_files.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-text-secondary mb-2">
                  Media ({selectedPost.media_files.length})
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedPost.media_files.map((file, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden bg-dark-700">
                      <img src={file} alt={`Media ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Platforms */}
            <div>
              <h4 className="text-sm font-medium text-text-secondary mb-2">Platforms</h4>
              <div className="flex flex-wrap gap-2">
                {selectedPost.platforms.map((platform) => (
                  <PlatformBadge key={platform} platform={platform} showLabel />
                ))}
              </div>
            </div>

            {/* Results */}
            <PublishingResults
              results={selectedPost.platform_results ?? []}
              postStatus={selectedPost.status}
            />

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-white/10">
              {(selectedPost.status === 'scheduled' || selectedPost.status === 'draft') && (
                <Link to={`/posts/${selectedPost.id}/edit`} className="flex-1">
                  <Button fullWidth variant="secondary" leftIcon={<PencilIcon className="w-5 h-5" />}>
                    Edit Post
                  </Button>
                </Link>
              )}
              {selectedPost.status === 'posted' && selectedPost.platforms.includes('facebook') && (
                <button
                  type="button"
                  onClick={() => {
                    setBoostingPost(selectedPost);
                    setSelectedPost(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                >
                  <RocketLaunchIcon className="w-5 h-5" />
                  Boost Post
                </button>
              )}
              {(selectedPost.status === 'scheduled' || selectedPost.status === 'draft') && (
                <button
                  type="button"
                  onClick={() => { setBoostContentOpen(true); setSelectedPost(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 text-sm font-bold transition-all flex items-center justify-center gap-2"
                  title="Queue a paid boost that launches automatically once this post publishes"
                >
                  <RocketLaunchIcon className="w-5 h-5" />
                  Boost when published
                </button>
              )}
              <Button variant="secondary" onClick={() => setSelectedPost(null)}>
                Close
              </Button>
            </div>

            {/* Comment threads, one tab per platform this post reached. */}
            <PostCommentTabs post={selectedPost} />
          </div>
        )}
      </Modal>

      {/* Boost Post Modal */}
      <BoostPostModal
        isOpen={!!boostingPost}
        onClose={() => setBoostingPost(null)}
        preselectedPost={boostingPost}
      />

      {/* Boost from Content — pick a post (incl. scheduled) & queue/launch a boost */}
      <BoostFromContentModal
        isOpen={boostContentOpen}
        onClose={() => setBoostContentOpen(false)}
        onSuccess={() => { setBoostContentOpen(false); fetchPosts(); }}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteModalPost}
        onClose={() => setDeleteModalPost(null)}
        onConfirm={handleDelete}
        title="Delete Post"
        message="Are you sure you want to delete this post? If it was published, it will also be removed from Instagram. This action cannot be undone and all associated data will be permanently removed."
        confirmText="Delete Post"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Cancel Confirmation */}
      <ConfirmModal
        isOpen={!!cancelModalPost}
        onClose={() => setCancelModalPost(null)}
        onConfirm={handleCancel}
        title="Cancel Scheduled Post"
        message="Are you sure you want to cancel this scheduled post? It will not be published to any platforms."
        confirmText="Cancel Post"
        variant="warning"
        isLoading={isCancelling}
      />
    </div>
  );
}

export default MyPostsPage;
