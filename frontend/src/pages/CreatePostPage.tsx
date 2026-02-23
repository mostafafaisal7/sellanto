import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhotoIcon,
  VideoCameraIcon,
  SparklesIcon,
  CalendarIcon,
  ClockIcon,
  XMarkIcon,
  PlusIcon,
  ArrowLeftIcon,
  PaperAirplaneIcon,
  DocumentDuplicateIcon,
  HashtagIcon,
  FaceSmileIcon,
  MegaphoneIcon,
  BriefcaseIcon,
  ChatBubbleLeftRightIcon,
  HeartIcon,
  FireIcon,
  LightBulbIcon,
  UserIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { Button, Card, Input, Textarea, Modal, PlatformIcon, platformColors, platformNames } from '../components/ui';
import { CaptionEditor } from '../components/CaptionEditor';
import { HashtagManager } from '../components/HashtagManager';
import { DraftChecklistWidget } from '../components/DraftChecklistWidget';
import { PlatformPreviewPanel } from '../components/PlatformPreviewPanel';
import { CreativeGenerator } from '../components/CreativeGenerator';
import { usePostStore } from '../store';
import type { PlatformType } from '../types';
import { authFetch } from '../services/api';
import api from '../services/api';
import { postService } from '../services';

const platforms: { id: PlatformType; maxChars: number }[] = [
  { id: 'facebook', maxChars: 63206 },
  { id: 'instagram', maxChars: 2200 },
  { id: 'twitter', maxChars: 280 },
  { id: 'linkedin', maxChars: 3000 },
  { id: 'tiktok', maxChars: 2200 },
  { id: 'pinterest', maxChars: 500 },
];

const tones = [
  { id: 'professional', label: 'Professional', Icon: BriefcaseIcon },
  { id: 'casual', label: 'Casual', Icon: ChatBubbleLeftRightIcon },
  { id: 'friendly', label: 'Friendly', Icon: HeartIcon },
  { id: 'enthusiastic', label: 'Enthusiastic', Icon: FireIcon },
  { id: 'humorous', label: 'Humorous', Icon: FaceSmileIcon },
  { id: 'inspirational', label: 'Inspirational', Icon: LightBulbIcon },
];

const postSchema = z.object({
  caption: z.string().min(1, 'Caption is required').max(63206),
  platforms: z.array(z.string()).min(1, 'Select at least one platform'),
  scheduled_date: z.string().min(1, 'Date is required'),
  scheduled_time: z.string().min(1, 'Time is required'),
  timezone: z.string().min(1),
});

type PostFormData = z.infer<typeof postSchema>;

export function CreatePostPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEditing = !!id;
  const { createPost, updatePost, posts } = usePostStore();
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [existingMedia, setExistingMedia] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiTone, setAiTone] = useState('professional');
  const [aiOptions, setAiOptions] = useState({
    hashtags: true,
    emojis: true,
    cta: false,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [contentTab, setContentTab] = useState<'captions' | 'hashtags' | 'creative' | 'preview'>('captions');
  const [checklistKey, setChecklistKey] = useState(0);

  // Brand / Pillar / Goal selectors
  const [brands, setBrands] = useState<{ id: number; brand_name: string }[]>([]);
  const [pillarOptions, setPillarOptions] = useState<{ id: number; name: string }[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<number | ''>('');
  const [selectedPillar, setSelectedPillar] = useState<number | ''>('');
  const [selectedGoal, setSelectedGoal] = useState<string>('');

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      platforms: [],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      scheduled_date: format(new Date(), 'yyyy-MM-dd'),
      scheduled_time: format(new Date(Date.now() + 3600000), 'HH:mm'),
    },
  });

  // Load existing post data when editing
  useEffect(() => {
    if (isEditing && id) {
      const loadPost = async () => {
        // Try store first
        let post = posts.find((p) => p.id === Number(id));
        // If not in store, fetch from API
        if (!post) {
          try {
            post = await postService.get(Number(id));
          } catch (err) {
            console.error('Failed to load post:', err);
            return;
          }
        }
        if (post) {
          const scheduledDate = new Date(post.scheduled_time);
          reset({
            caption: post.caption || '',
            platforms: post.platforms || [],
            scheduled_date: format(scheduledDate, 'yyyy-MM-dd'),
            scheduled_time: format(scheduledDate, 'HH:mm'),
            timezone: post.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          });
          setExistingMedia(post.media_files || []);
        }
      };
      loadPost();
    }
  }, [isEditing, id, posts, reset]);

  // Pre-fill caption from AI Caption page
  useEffect(() => {
    const state = location.state as { caption?: string } | null;
    if (state?.caption) {
      setValue('caption', state.caption);
    }
  }, [location.state, setValue]);

  // Fetch brands on mount
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const res = await api.get('/brands/');
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setBrands(data);
      } catch (err) {
        console.error('Failed to fetch brands:', err);
      }
    };
    fetchBrands();
  }, []);

  // Fetch pillars (optionally filtered by brand)
  useEffect(() => {
    const fetchPillars = async () => {
      try {
        const params: Record<string, unknown> = {};
        if (selectedBrand) {
          params.brand_id = selectedBrand;
        }
        const res = await api.get('/content-pillars/', { params });
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setPillarOptions(data);
        // Reset pillar selection if the current one is no longer in the list
        if (selectedPillar && !data.find((p: { id: number }) => p.id === selectedPillar)) {
          setSelectedPillar('');
        }
      } catch (err) {
        console.error('Failed to fetch pillars:', err);
      }
    };
    fetchPillars();
  }, [selectedBrand]);

  const watchCaption = watch('caption', '');
  const watchPlatforms = watch('platforms', []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/')
    );
    addFiles(files);
  }, []);

  const addFiles = (files: File[]) => {
    const availableSlots = 10 - mediaFiles.length - existingMedia.length;
    const newFiles = [...mediaFiles, ...files.slice(0, availableSlots)];
    setMediaFiles(newFiles);

    const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
    mediaPreviews.forEach((url) => URL.revokeObjectURL(url));
    setMediaPreviews(newPreviews);
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(mediaPreviews[index]);
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingMedia = (index: number) => {
    setExistingMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const copyToClipboard = async () => {
    if (watchCaption) {
      await navigator.clipboard.writeText(watchCaption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const generateAICaption = async () => {
    if (!aiTopic.trim()) return;
    setIsGenerating(true);
    try {
      const response = await authFetch('/api/v1/ai-caption/generate/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: aiTopic,
          tone: aiTone,
          length: 'medium',
          platform: watchPlatforms[0] || 'general',
          include_hashtags: aiOptions.hashtags,
          include_emojis: aiOptions.emojis,
          include_cta: aiOptions.cta,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setValue('caption', data.caption || data.content || '');
        setShowAIModal(false);
        setAiTopic('');
      }
    } catch (error) {
      console.error('Failed to generate caption:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const onSubmit = async (data: PostFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const scheduledTime = new Date(`${data.scheduled_date}T${data.scheduled_time}`);

      const postData = {
        caption: data.caption,
        platforms: data.platforms as PlatformType[],
        scheduled_time: scheduledTime.toISOString(),
        timezone: data.timezone,
        media_files: mediaFiles,
        ...(selectedBrand ? { brand: selectedBrand as number } : {}),
        ...(selectedPillar ? { pillar: selectedPillar as number } : {}),
        ...(selectedGoal ? { goal: selectedGoal } : {}),
      };

      if (isEditing && id) {
        await updatePost(Number(id), postData);
      } else {
        await createPost(postData);
      }

      navigate('/posts');
    } catch (error: unknown) {
      console.error('Failed to save post:', error);
      if (error instanceof Error) {
        setSubmitError(error.message || 'Failed to schedule post. Please try again.');
      } else {
        setSubmitError('Failed to schedule post. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!id) return;
    setIsSubmittingApproval(true);
    setSubmitError(null);
    try {
      // Save post first
      const data = watch();
      const scheduledTime = new Date(`${data.scheduled_date}T${data.scheduled_time}`);
      await updatePost(Number(id), {
        caption: data.caption,
        platforms: data.platforms as PlatformType[],
        scheduled_time: scheduledTime.toISOString(),
        timezone: data.timezone,
        media_files: mediaFiles,
      });
      // Then submit for approval
      await api.post(`/drafts/${id}/submit/`, {});
      setSuccessMsg('Post submitted for approval!');
      setTimeout(() => navigate('/posts'), 1500);
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || 'Failed to submit for approval.';
      setSubmitError(msg);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const getMinCharLimit = () => {
    if (watchPlatforms.length === 0) return 5000;
    return Math.min(
      ...watchPlatforms.map((p) => platforms.find((pl) => pl.id === p)?.maxChars || 5000)
    );
  };

  const charLimit = getMinCharLimit();
  const charCount = watchCaption.length;
  const charPercentage = (charCount / charLimit) * 100;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeftIcon className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">
            {isEditing ? 'Edit Post' : 'Create New Post'}
          </h1>
          <p className="text-text-secondary">
            {isEditing ? 'Update your scheduled post' : 'Schedule content across multiple platforms'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Platform Selection */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Select Platforms</h2>
                  <p className="text-sm text-text-secondary">Choose where to publish your content</p>
                </div>
              </div>
              <Controller
                name="platforms"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {platforms.map((platform) => {
                      const isSelected = field.value.includes(platform.id);
                      const colors = platformColors[platform.id];
                      return (
                        <motion.button
                          key={platform.id}
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            const newValue = isSelected
                              ? field.value.filter((p) => p !== platform.id)
                              : [...field.value, platform.id];
                            field.onChange(newValue);
                          }}
                          className={`relative p-4 rounded-xl border-2 transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/10'
                              : 'border-white/10 bg-dark-700/50 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
                              <PlatformIcon platform={platform.id} className="text-white" size="md" />
                            </div>
                            <div className="text-left">
                              <span className="font-medium text-text-primary block">
                                {platformNames[platform.id]}
                              </span>
                              <span className="text-xs text-text-muted">
                                {platform.maxChars.toLocaleString()} chars
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center"
                            >
                              <CheckIcon className="w-4 h-4 text-white" />
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              />
              {errors.platforms && (
                <p className="mt-3 text-sm text-danger flex items-center gap-2">
                  <XMarkIcon className="w-4 h-4" />
                  {errors.platforms.message}
                </p>
              )}
            </Card>

            {/* Brand / Pillar / Goal Selectors */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <BriefcaseIcon className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Content Strategy</h2>
                  <p className="text-sm text-text-secondary">Assign brand, pillar, and goal</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Brand Selector */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Brand
                  </label>
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-white/10 bg-dark-700/50 text-text-primary text-sm focus:border-primary focus:outline-none transition-colors"
                  >
                    <option value="">Select a brand...</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.brand_name}</option>
                    ))}
                  </select>
                </div>

                {/* Pillar Selector */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Content Pillar
                  </label>
                  <select
                    value={selectedPillar}
                    onChange={(e) => setSelectedPillar(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-white/10 bg-dark-700/50 text-text-primary text-sm focus:border-primary focus:outline-none transition-colors"
                  >
                    <option value="">Select a pillar...</option>
                    {pillarOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Goal Selector */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Goal
                  </label>
                  <select
                    value={selectedGoal}
                    onChange={(e) => setSelectedGoal(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-white/10 bg-dark-700/50 text-text-primary text-sm focus:border-primary focus:outline-none transition-colors"
                  >
                    <option value="">Select a goal...</option>
                    <option value="leads">Lead Generation</option>
                    <option value="growth">Audience Growth</option>
                    <option value="authority">Thought Leadership</option>
                  </select>
                </div>
              </div>
            </Card>

            {/* Caption Editor */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <DocumentDuplicateIcon className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">Caption</h2>
                    <p className="text-sm text-text-secondary">Write or generate your message</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leftIcon={<SparklesIcon className="w-4 h-4" />}
                  onClick={() => setShowAIModal(true)}
                >
                  AI Generate
                </Button>
              </div>

              <Textarea
                placeholder="Write your caption here... Use AI to generate engaging content!"
                rows={6}
                {...register('caption')}
                error={errors.caption?.message}
              />

              {/* Character count & tools */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const hashtags = '\n\n#socialmedia #marketing #content';
                      setValue('caption', watchCaption + hashtags);
                    }}
                    className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-dark-600 transition-colors"
                    title="Add hashtags"
                  >
                    <HashtagIcon className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-dark-600 transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <CheckIcon className="w-5 h-5 text-success" />
                    ) : (
                      <DocumentDuplicateIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-dark-600 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${
                        charPercentage > 90
                          ? 'bg-danger'
                          : charPercentage > 70
                          ? 'bg-warning'
                          : 'bg-gradient-to-r from-primary to-secondary'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(charPercentage, 100)}%` }}
                    />
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      charPercentage > 90
                        ? 'text-danger'
                        : charPercentage > 70
                        ? 'text-warning'
                        : 'text-text-muted'
                    }`}
                  >
                    {charCount.toLocaleString()}/{charLimit.toLocaleString()}
                  </span>
                </div>
              </div>
            </Card>

            {/* Media Upload */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <PhotoIcon className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Media</h2>
                  <p className="text-sm text-text-secondary">Add images or videos to your post</p>
                </div>
              </div>

              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  dragActive
                    ? 'border-primary bg-primary/10'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-dark-600 flex items-center justify-center">
                    <PhotoIcon className="w-8 h-8 text-text-muted" />
                  </div>
                  <div>
                    <p className="text-text-primary font-medium">
                      Drag & drop files here, or click to browse
                    </p>
                    <p className="text-sm text-text-muted mt-1">
                      Supports images and videos (max 10 files)
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-text-muted">
                    <div className="flex items-center gap-2">
                      <PhotoIcon className="w-5 h-5" />
                      <span className="text-sm">Images</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-text-muted" />
                    <div className="flex items-center gap-2">
                      <VideoCameraIcon className="w-5 h-5" />
                      <span className="text-sm">Videos</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Media Previews */}
              <AnimatePresence>
                {(mediaPreviews.length > 0 || existingMedia.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3"
                  >
                    {/* Existing media */}
                    {existingMedia.map((url, index) => (
                      <motion.div
                        key={`existing-${index}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="relative aspect-square rounded-xl overflow-hidden bg-dark-700 group"
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeExistingMedia(index)}
                          className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-danger rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <XMarkIcon className="w-4 h-4 text-white" />
                        </button>
                      </motion.div>
                    ))}
                    {/* New media */}
                    {mediaPreviews.map((preview, index) => (
                      <motion.div
                        key={preview}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="relative aspect-square rounded-xl overflow-hidden bg-dark-700 group"
                      >
                        {mediaFiles[index]?.type.startsWith('video/') ? (
                          <video src={preview} className="w-full h-full object-cover" />
                        ) : (
                          <img src={preview} alt="" className="w-full h-full object-cover" />
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-danger rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <XMarkIcon className="w-4 h-4 text-white" />
                        </button>
                        {mediaFiles[index]?.type.startsWith('video/') && (
                          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded-lg flex items-center gap-1">
                            <VideoCameraIcon className="w-3 h-3 text-white" />
                            <span className="text-xs text-white">Video</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                    {mediaPreviews.length + existingMedia.length < 10 && (
                      <label className="aspect-square rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <PlusIcon className="w-8 h-8 text-text-muted" />
                      </label>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* V1.2.1 — AI Captions / Hashtags / Creative tabs (only when editing) */}
            {isEditing && id && (
              <Card>
                {/* Tab Bar */}
                <div className="flex border-b border-white/10 mb-4">
                  {(['captions', 'hashtags', 'creative', 'preview'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setContentTab(tab)}
                      className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                        contentTab === tab
                          ? 'border-primary-500 text-primary-400'
                          : 'border-transparent text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {tab === 'captions' ? 'AI Captions' : tab === 'hashtags' ? 'Hashtags' : tab === 'creative' ? 'Creative' : 'Preview'}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                {contentTab === 'captions' && (
                  <CaptionEditor
                    postId={Number(id)}
                    onCaptionChange={() => setChecklistKey((k) => k + 1)}
                  />
                )}
                {contentTab === 'hashtags' && (
                  <HashtagManager
                    postId={Number(id)}
                    platform={watchPlatforms[0] || 'instagram'}
                  />
                )}
                {contentTab === 'creative' && (
                  <CreativeGenerator
                    postId={Number(id)}
                    onAssetGenerated={() => setChecklistKey((k) => k + 1)}
                  />
                )}
                {contentTab === 'preview' && (
                  <PlatformPreviewPanel
                    caption={watchCaption}
                    mediaUrl={existingMedia[0] || mediaPreviews[0]}
                    platforms={watchPlatforms}
                  />
                )}
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Draft Checklist (only when editing) */}
            {isEditing && id && (
              <DraftChecklistWidget
                key={checklistKey}
                postId={Number(id)}
                onSubmit={() => {
                  setSuccessMsg('Post submitted for approval!');
                  setTimeout(() => navigate('/posts'), 1500);
                }}
              />
            )}

            {/* Schedule */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Schedule</h2>
                  <p className="text-sm text-text-secondary">When to publish</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
                    <CalendarIcon className="w-4 h-4" />
                    Date
                  </label>
                  <Input
                    type="date"
                    min={format(new Date(), 'yyyy-MM-dd')}
                    {...register('scheduled_date')}
                    error={errors.scheduled_date?.message}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
                    <ClockIcon className="w-4 h-4" />
                    Time
                  </label>
                  <Input
                    type="time"
                    {...register('scheduled_time')}
                    error={errors.scheduled_time?.message}
                  />
                </div>

                <div className="p-3 bg-dark-700/50 rounded-xl">
                  <p className="text-xs text-text-muted">
                    Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </p>
                </div>
              </div>
            </Card>

            {/* Preview */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <PhotoIcon className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary">Preview</h2>
              </div>

              <div className="bg-dark-800 rounded-xl p-3 border border-white/5">
                <div className="aspect-[9/16] bg-dark-700 rounded-lg overflow-hidden">
                  <div className="h-full flex flex-col">
                    {/* Header */}
                    <div className="p-3 flex items-center gap-2 border-b border-white/5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary" />
                      <div>
                        <p className="text-xs font-medium text-text-primary">Your Account</p>
                        <p className="text-[10px] text-text-muted">Just now</p>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-3 overflow-hidden">
                      {(mediaPreviews.length > 0 || existingMedia.length > 0) && (
                        <div className="aspect-square rounded-lg overflow-hidden mb-2 bg-dark-600">
                          <img
                            src={existingMedia[0] || mediaPreviews[0]}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <p className="text-xs text-text-primary line-clamp-4">
                        {watchCaption || 'Your caption will appear here...'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Platform indicators */}
              {watchPlatforms.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {watchPlatforms.map((platformId) => (
                    <span
                      key={platformId}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-dark-600 rounded-lg text-xs text-text-secondary"
                    >
                      <PlatformIcon platform={platformId as PlatformType} size="sm" />
                      {platformNames[platformId as PlatformType]}
                    </span>
                  ))}
                </div>
              )}
            </Card>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {/* Success Message */}
              <AnimatePresence>
                {successMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl"
                  >
                    <p className="text-sm font-medium text-green-400">{successMsg}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Message Display */}
              <AnimatePresence>
                {submitError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 bg-danger/10 border border-danger/30 rounded-xl"
                  >
                    <div className="flex items-start gap-3">
                      <XMarkIcon className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-danger">Failed to save post</p>
                        <p className="text-xs text-danger/80 mt-1">{submitError}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                fullWidth
                size="lg"
                isLoading={isSubmitting}
                leftIcon={<PaperAirplaneIcon className="w-5 h-5" />}
              >
                {isEditing ? 'Update Post' : 'Schedule Post'}
              </Button>
              {isEditing && (
                <Button
                  type="button"
                  fullWidth
                  size="lg"
                  variant="secondary"
                  isLoading={isSubmittingApproval}
                  leftIcon={<CheckIcon className="w-5 h-5" />}
                  onClick={handleSubmitForApproval}
                >
                  Submit for Approval
                </Button>
              )}
              <Button type="button" variant="secondary" fullWidth onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* AI Caption Modal */}
      <Modal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        title="Generate AI Caption"
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              What is your post about?
            </label>
            <Textarea
              placeholder="Describe your post topic, product, or key message..."
              rows={3}
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">Select Tone</label>
            <div className="grid grid-cols-3 gap-2">
              {tones.map((tone) => (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => setAiTone(tone.id)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    aiTone === tone.id
                      ? 'border-primary bg-primary/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <tone.Icon className="w-6 h-6 mx-auto mb-1 text-text-primary" />
                  <p className="text-sm text-text-primary">{tone.label}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">Options</label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 bg-dark-700/50 rounded-xl cursor-pointer hover:bg-dark-700 transition-colors">
                <input
                  type="checkbox"
                  checked={aiOptions.hashtags}
                  onChange={(e) => setAiOptions({ ...aiOptions, hashtags: e.target.checked })}
                  className="w-4 h-4 rounded border-white/20 bg-dark-600 text-primary focus:ring-primary/50"
                />
                <HashtagIcon className="w-5 h-5 text-text-muted" />
                <span className="text-text-primary">Include hashtags</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-dark-700/50 rounded-xl cursor-pointer hover:bg-dark-700 transition-colors">
                <input
                  type="checkbox"
                  checked={aiOptions.emojis}
                  onChange={(e) => setAiOptions({ ...aiOptions, emojis: e.target.checked })}
                  className="w-4 h-4 rounded border-white/20 bg-dark-600 text-primary focus:ring-primary/50"
                />
                <FaceSmileIcon className="w-5 h-5 text-text-muted" />
                <span className="text-text-primary">Include emojis</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-dark-700/50 rounded-xl cursor-pointer hover:bg-dark-700 transition-colors">
                <input
                  type="checkbox"
                  checked={aiOptions.cta}
                  onChange={(e) => setAiOptions({ ...aiOptions, cta: e.target.checked })}
                  className="w-4 h-4 rounded border-white/20 bg-dark-600 text-primary focus:ring-primary/50"
                />
                <MegaphoneIcon className="w-5 h-5 text-text-muted" />
                <span className="text-text-primary">Include call-to-action</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              fullWidth
              onClick={generateAICaption}
              isLoading={isGenerating}
              disabled={!aiTopic.trim()}
              leftIcon={<SparklesIcon className="w-5 h-5" />}
            >
              Generate Caption
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowAIModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default CreatePostPage;
