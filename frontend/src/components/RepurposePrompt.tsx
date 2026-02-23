import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  SparklesIcon,
  CheckCircleIcon,
  ArrowTopRightOnSquareIcon,
  RectangleGroupIcon,
  ChatBubbleBottomCenterTextIcon,
  FilmIcon,
  EnvelopeIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';

interface Props {
  postId: number;
  isOpen: boolean;
  onClose: () => void;
  onRepurpose?: (newPostId: number) => void;
}

type RepurposeFormat = 'carousel' | 'thread' | 'reel' | 'email' | 'blog_outline';

interface FormatOption {
  key: RepurposeFormat;
  label: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
  bgColor: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    key: 'carousel',
    label: 'Carousel',
    description: 'Transform into a multi-slide carousel post for Instagram or LinkedIn',
    icon: RectangleGroupIcon,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  {
    key: 'thread',
    label: 'Thread',
    description: 'Break down into a Twitter/X thread with multiple connected tweets',
    icon: ChatBubbleBottomCenterTextIcon,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  {
    key: 'reel',
    label: 'Reel / Short',
    description: 'Generate a script and storyboard for a short-form video',
    icon: FilmIcon,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
  },
  {
    key: 'email',
    label: 'Email',
    description: 'Repurpose content into an email newsletter or campaign',
    icon: EnvelopeIcon,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
  },
  {
    key: 'blog_outline',
    label: 'Blog Outline',
    description: 'Expand into a structured blog post outline with key sections',
    icon: DocumentTextIcon,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
  },
];

export function RepurposePrompt({ postId, isOpen, onClose, onRepurpose }: Props) {
  const [selected, setSelected] = useState<RepurposeFormat | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ newPostId: number; format: string } | null>(null);

  const handleRepurpose = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/posts/${postId}/repurpose/`, {
        repurpose_format: selected,
      });
      const newPostId = res.data.new_post_id || res.data.id;
      const formatLabel = FORMAT_OPTIONS.find((f) => f.key === selected)?.label || selected;
      setSuccess({ newPostId, format: formatLabel });
      onRepurpose?.(newPostId);
    } catch (err) {
      console.error('Failed to repurpose post:', err);
      setError('Failed to repurpose post. Please try again.');
    }
    setLoading(false);
  };

  const handleClose = () => {
    setSelected(null);
    setError(null);
    setSuccess(null);
    setLoading(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            className="relative w-full max-w-lg mx-4 bg-dark-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                  <SparklesIcon className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary">Repurpose this winning post?</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Choose a format to transform your content
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="btn-icon"
                title="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 pb-5">
              {success ? (
                /* Success state */
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-6 space-y-4"
                >
                  <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                    <CheckCircleIcon className="w-8 h-8 text-green-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-text-primary">
                      Content Repurposed!
                    </p>
                    <p className="text-sm text-text-secondary mt-1">
                      Your {success.format} draft has been created successfully.
                    </p>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={handleClose}
                      className="btn-secondary text-sm px-4 py-2"
                    >
                      Close
                    </button>
                    <a
                      href={`/posts/${success.newPostId}/edit`}
                      className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5 no-underline"
                    >
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                      View Draft
                    </a>
                  </div>
                </motion.div>
              ) : (
                /* Format selection */
                <>
                  {/* Error banner */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-400 mb-4"
                    >
                      {error}
                    </motion.div>
                  )}

                  {/* Format cards */}
                  <div className="space-y-2">
                    {FORMAT_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const isSelected = selected === option.key;

                      return (
                        <motion.button
                          key={option.key}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setSelected(option.key)}
                          disabled={loading}
                          className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? `${option.bgColor} border-current ${option.color}`
                              : 'bg-dark-700/30 border-white/5 hover:border-white/10 hover:bg-dark-700/50'
                          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isSelected ? option.bgColor : 'bg-dark-700'
                            }`}
                          >
                            <Icon
                              className={`w-5 h-5 ${
                                isSelected ? option.color : 'text-text-muted'
                              }`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium ${
                                isSelected ? option.color : 'text-text-primary'
                              }`}
                            >
                              {option.label}
                            </p>
                            <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                              {option.description}
                            </p>
                          </div>
                          {/* Selection indicator */}
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                              isSelected
                                ? `border-current ${option.color}`
                                : 'border-white/20'
                            }`}
                          >
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className={`w-2.5 h-2.5 rounded-full bg-current`}
                              />
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={handleClose}
                      disabled={loading}
                      className="btn-secondary flex-1 py-2.5"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRepurpose}
                      disabled={!selected || loading}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                        selected && !loading
                          ? 'btn-primary'
                          : 'bg-dark-700 text-text-secondary cursor-not-allowed'
                      }`}
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          Repurposing...
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="w-4 h-4" />
                          Repurpose
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default RepurposePrompt;
