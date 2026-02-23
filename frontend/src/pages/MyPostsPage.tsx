import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
} from '@heroicons/react/24/outline';
import { format, formatDistanceToNow } from 'date-fns';
import { Button, Card, StatusBadge, PlatformBadge, Modal, ConfirmModal, LoadingPlaceholder } from '../components/ui';
import { usePostStore } from '../store';
import type { Post, PostStatus } from '../types';

const statusFilters: { value: PostStatus | 'all'; label: string; icon: typeof DocumentTextIcon; color: string }[] = [
  { value: 'all', label: 'All', icon: DocumentTextIcon, color: 'text-text-primary' },
  { value: 'scheduled', label: 'Scheduled', icon: ClockIcon, color: 'text-info' },
  { value: 'posted', label: 'Posted', icon: CheckCircleIcon, color: 'text-success' },
  { value: 'failed', label: 'Failed', icon: XCircleIcon, color: 'text-danger' },
];

export function MyPostsPage() {
  const { posts, totalCount, isLoading, statusFilter, fetchPosts, setStatusFilter, deletePost, cancelPost } = usePostStore();
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [deleteModalPost, setDeleteModalPost] = useState<Post | null>(null);
  const [cancelModalPost, setCancelModalPost] = useState<Post | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [_viewMode, _setViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

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
            {selectedPost.platform_results && selectedPost.platform_results.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-text-secondary mb-2">Publishing Results</h4>
                <div className="space-y-2">
                  {selectedPost.platform_results.map((result, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-xl ${
                        result.success ? 'bg-success/10 border border-success/20' : 'bg-danger/10 border border-danger/20'
                      }`}
                    >
                      {result.success ? (
                        <CheckCircleIcon className="w-5 h-5 text-success" />
                      ) : (
                        <XCircleIcon className="w-5 h-5 text-danger" />
                      )}
                      <span className="text-sm capitalize font-medium">{result.platform}</span>
                      <span className={`text-sm ${result.success ? 'text-success' : 'text-danger'}`}>
                        {result.success ? 'Published successfully' : result.error || 'Failed to publish'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-white/10">
              {(selectedPost.status === 'scheduled' || selectedPost.status === 'draft') && (
                <Link to={`/posts/${selectedPost.id}/edit`} className="flex-1">
                  <Button fullWidth variant="secondary" leftIcon={<PencilIcon className="w-5 h-5" />}>
                    Edit Post
                  </Button>
                </Link>
              )}
              <Button variant="secondary" onClick={() => setSelectedPost(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteModalPost}
        onClose={() => setDeleteModalPost(null)}
        onConfirm={handleDelete}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone and all associated data will be permanently removed."
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
