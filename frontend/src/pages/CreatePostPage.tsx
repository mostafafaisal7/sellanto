import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhotoIcon,
  VideoCameraIcon,
  CalendarIcon,
  ClockIcon,
  XMarkIcon,
  PlusIcon,
  ArrowLeftIcon,
  PaperAirplaneIcon,
  BoltIcon,
  DocumentDuplicateIcon,
  HashtagIcon,
  UserIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { Button, Card, Input, Textarea, PlatformIcon, platformColors, platformNames, HelpButton } from '../components/ui';
import { usePostStore } from '../store';
import type { PlatformType, SocialAccount } from '../types';
import api from '../services/api';
import { postService, platformService } from '../services';
import calendarService from '../services/calendarService';
import ConnectAccountModal from '../components/ConnectAccountModal';
import { describeDestinations } from '../utils/platformDestinations';

const platforms: { id: PlatformType; maxChars: number }[] = [
  { id: 'facebook', maxChars: 63206 },
  { id: 'instagram', maxChars: 2200 },
  { id: 'twitter', maxChars: 280 },
  { id: 'linkedin', maxChars: 3000 },
  { id: 'tiktok', maxChars: 2200 },
  { id: 'pinterest', maxChars: 500 },
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
  const mediaFilesRef = useRef<File[]>([]);
  mediaFilesRef.current = mediaFiles;
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [existingMedia, setExistingMedia] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<SocialAccount[]>([]);
  const [disconnectedPlatforms, setDisconnectedPlatforms] = useState<string[]>([]);
  const [publishNow, setPublishNow] = useState(false);
  // Which button submitted the form. A ref, not state, because onSubmit runs
  // inside the same tick as the click and would read a stale state value;
  // isPostingNow exists only to drive the button's spinner.
  const postNowRef = useRef(false);
  const [isPostingNow, setIsPostingNow] = useState(false);
  const [imageReady, setImageReady] = useState(true);
  const pendingPublish = useRef(false);

  const [recommendedTimes, setRecommendedTimes] = useState<Array<{ day_of_week: number; hour_utc: number; score: number; platform: string; reason?: string }>>([]);

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
          let dateStr = '';
          let timeStr = format(new Date(Date.now() + 3600000), 'HH:mm');
          if (post.scheduled_time) {
            const scheduledDate = new Date(post.scheduled_time);
            if (!isNaN(scheduledDate.getTime())) {
              dateStr = format(scheduledDate, 'yyyy-MM-dd');
              timeStr = format(scheduledDate, 'HH:mm');
            }
          }
          const plats = Array.isArray(post.platforms) ? post.platforms : [];
          reset({
            caption: post.caption || '',
            platforms: plats,
            scheduled_date: dateStr,
            scheduled_time: timeStr,
            timezone: post.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          });
          setExistingMedia(post.media_files || []);
        }
      };
      loadPost();
    }
  }, [isEditing, id, posts, reset]);

  // Fetch connected social accounts
  useEffect(() => {
    platformService.list().then(setConnectedAccounts).catch(() => {});
  }, []);

  // Pre-fill data from AI Caption page or Magic Mode
  useEffect(() => {
    const state = location.state as {
      caption?: string;
      platform?: string;
      title?: string;
      imageUrl?: string;
      publishNow?: boolean;
    } | null;
    if (!state) return;

    if (state.caption) setValue('caption', state.caption);
    if (state.platform) setValue('platforms', [state.platform]);
    if (state.publishNow) setPublishNow(true);

    // Download Magic Mode image and add as file for upload
    if (state.imageUrl) {
      // Normalize URL — same as Overflow's toMediaUrl
      let imgUrl = state.imageUrl;
      if (!imgUrl.startsWith('http') && !imgUrl.startsWith('blob:') && !imgUrl.startsWith('/media/')) {
        imgUrl = `/media/${imgUrl}`;
      }

      setImageReady(false);
      setExistingMedia([imgUrl]); // Show preview immediately
      fetch(imgUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const ext = imgUrl.split('.').pop()?.split('?')[0] || 'png';
          const file = new File([blob], `magic-image.${ext}`, { type: blob.type || 'image/png' });
          setMediaFiles([file]);
          setMediaPreviews([URL.createObjectURL(blob)]);
          setExistingMedia([]); // Switch from existingMedia to mediaPreviews
          setImageReady(true);
        })
        .catch(() => { setImageReady(true); /* no image, but ready to proceed */ });
    }
  }, [location.state, setValue]);

  // Fetch best times on mount
  useEffect(() => {
    const fetchBestTimes = async () => {
      try {
        const res = await api.get('/brands/');
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        if (data.length > 0) {
          const primary = data.find((b: { is_primary: boolean }) => b.is_primary) || data[0];
          try {
            const times = await calendarService.getBestTimes(primary.id);
            setRecommendedTimes(Array.isArray(times) ? times : []);
          } catch { /* no best times */ }
        }
      } catch { /* no brands */ }
    };
    fetchBestTimes();
  }, []);

  const watchCaption = watch('caption', '');
  const watchPlatforms = watch('platforms', []);
  const destinations = describeDestinations(watchPlatforms as string[]);

  // Auto-fill AI-suggested best time (replaces static 1hr default)
  useEffect(() => {
    if (recommendedTimes.length > 0 && !isEditing) {
      const state = location.state as { publishNow?: boolean } | null;
      if (state?.publishNow) return; // Publish Now sets its own time
      const t = recommendedTimes[0];
      const now = new Date();
      const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
      let daysToAdd = t.day_of_week - currentDay;
      if (daysToAdd < 0) daysToAdd += 7;
      if (daysToAdd === 0 && t.hour_utc <= now.getUTCHours()) daysToAdd = 7;
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysToAdd);
      setValue('scheduled_date', format(targetDate, 'yyyy-MM-dd'));
      setValue('scheduled_time', `${String(t.hour_utc).padStart(2, '0')}:00`);
    }
  }, [recommendedTimes]);

  // Auto-submit for Publish Now from Magic Mode — wait for image to be ready
  useEffect(() => {
    if (publishNow && watchCaption && watchPlatforms.length > 0) {
      const now = new Date();
      setValue('scheduled_date', format(now, 'yyyy-MM-dd'));
      setValue('scheduled_time', format(new Date(now.getTime() + 60000), 'HH:mm'));
      setPublishNow(false);
      pendingPublish.current = true;
    }
  }, [publishNow, watchCaption, watchPlatforms]);

  // Submit once image is ready (for Publish Now)
  useEffect(() => {
    if (pendingPublish.current && imageReady) {
      pendingPublish.current = false;
      setTimeout(() => handleSubmit(onSubmit)(), 50);
    }
  }, [imageReady]);

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

  const onSubmit = async (data: PostFormData) => {
    const immediate = postNowRef.current;
    postNowRef.current = false;
    setSubmitError(null);
    setDisconnectedPlatforms([]);

    // Check if selected platforms have connected accounts
    const activePlatforms = connectedAccounts
      .filter((a) => a.is_active)
      .map((a) => a.platform);
    const missing = data.platforms.filter((p) => !activePlatforms.includes(p as PlatformType));
    if (missing.length > 0) {
      const names = missing.map((p) => platformNames[p as PlatformType] || p);
      setDisconnectedPlatforms(names);
      setSubmitError(`No connected account for: ${names.join(', ')}. Please connect your accounts first.`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Posting now stamps the moment it actually goes out, so a live post
      // doesn't sit in the list with a scheduled time an hour in the future.
      const scheduledTime = immediate
        ? new Date()
        : new Date(`${data.scheduled_date}T${data.scheduled_time}`);

      const postData = {
        caption: data.caption,
        platforms: data.platforms as PlatformType[],
        scheduled_time: scheduledTime.toISOString(),
        timezone: data.timezone,
        media_files: mediaFilesRef.current,
      };

      const saved = isEditing && id
        ? await updatePost(Number(id), postData)
        : await createPost(postData);

      if (immediate && saved?.id) {
        // Goes out through the same publish_post() the scheduler calls — this
        // only skips the wait for its next 60-second tick.
        await postService.publishNow(saved.id);
      }

      navigate('/posts');
    } catch (error: unknown) {
      console.error('Failed to save post:', error);
      const fallback = immediate
        ? 'Failed to publish post. Please try again.'
        : 'Failed to schedule post. Please try again.';
      if (error instanceof Error) {
        setSubmitError(error.message || fallback);
      } else {
        setSubmitError(fallback);
      }
    } finally {
      setIsSubmitting(false);
      setIsPostingNow(false);
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
                render={({ field }) => {
                  const val = Array.isArray(field.value) ? field.value : [];
                  const accounts = Array.isArray(connectedAccounts) ? connectedAccounts : [];
                  return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {platforms.map((platform) => {
                      const isSelected = val.includes(platform.id);
                      const colors = platformColors[platform.id];
                      const isConnected = accounts.some(
                        (a) => a.platform === platform.id && a.is_active
                      );
                      return (
                        <motion.button
                          key={platform.id}
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            const newValue = isSelected
                              ? val.filter((p) => p !== platform.id)
                              : [...val, platform.id];
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
                              <span className={`text-xs ${!isConnected ? 'text-amber-400' : 'text-text-muted'}`}>
                                {isConnected ? `${platform.maxChars.toLocaleString()} chars` : 'Not connected'}
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
                  );
                }}
              />
              {errors.platforms && (
                <p className="mt-3 text-sm text-danger flex items-center gap-2">
                  <XMarkIcon className="w-4 h-4" />
                  {errors.platforms.message}
                </p>
              )}
            </Card>

            {/* Caption Editor */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <DocumentDuplicateIcon className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Caption</h2>
                  <p className="text-sm text-text-secondary">Write your message</p>
                </div>
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

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
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

                {/* Recommended Times */}
                {recommendedTimes.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-text-secondary mb-2">Recommended Times</p>
                    <div className="flex flex-wrap gap-1.5">
                      {recommendedTimes.slice(0, 6).map((t, i) => {
                        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                        const dayName = days[t.day_of_week] || 'Mon';
                        const hour12 = t.hour_utc % 12 || 12;
                        const ampm = t.hour_utc < 12 ? 'AM' : 'PM';
                        const label = `${dayName} ${hour12}:00 ${ampm}`;
                        const isCompetitor = (t as { source?: string }).source === 'competitor_analysis';

                        // Calculate the next date for this day_of_week
                        const now = new Date();
                        const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1; // Convert Sun=0 to Mon=0
                        let daysToAdd = t.day_of_week - currentDay;
                        if (daysToAdd < 0) daysToAdd += 7;
                        if (daysToAdd === 0 && t.hour_utc <= now.getUTCHours()) daysToAdd = 7;
                        const targetDate = new Date(now);
                        targetDate.setDate(targetDate.getDate() + daysToAdd);

                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setValue('scheduled_date', format(targetDate, 'yyyy-MM-dd'));
                              const hourStr = String(t.hour_utc).padStart(2, '0');
                              setValue('scheduled_time', `${hourStr}:00`);
                            }}
                            className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                              isCompetitor
                                ? 'border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                                : 'border-white/10 bg-dark-700 text-text-secondary hover:bg-dark-600'
                            }`}
                            title={t.reason || `Score: ${(t.score * 100).toFixed(0)}%`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
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
              {/* Error Message Display */}
              <AnimatePresence>
                {submitError && disconnectedPlatforms.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 bg-danger/10 border border-danger/30 rounded-xl"
                  >
                    <div className="flex items-start gap-3">
                      <XMarkIcon className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-danger">Failed to save post</p>
                        <p className="text-xs text-danger/80 mt-1">{submitError}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <ConnectAccountModal
                open={disconnectedPlatforms.length > 0}
                message={submitError || 'Please connect your accounts first.'}
                onClose={() => { setDisconnectedPlatforms([]); setSubmitError(null); }}
              />

              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  isLoading={isSubmitting && !isPostingNow}
                  disabled={isPostingNow}
                  leftIcon={<PaperAirplaneIcon className="w-5 h-5" />}
                >
                  {isEditing ? 'Update Post' : 'Schedule Post'}
                </Button>
                <HelpButton
                  size="md"
                  title={isEditing ? 'Update Post' : 'Schedule Post'}
                  body={destinations
                    ? <>Publishes to <strong>{destinations}</strong> automatically at the{' '}
                        <strong>date and time set above</strong>.</>
                    : <>Publishes automatically at the date and time set above.{' '}
                        <strong>Choose a platform first.</strong></>}
                />
              </div>
              {/* Publishes straight away instead of queuing for the scheduler.
                  Kept secondary so the established primary action, and the
                  habit of clicking it, still schedules. */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  size="lg"
                  isLoading={isPostingNow}
                  disabled={isSubmitting && !isPostingNow}
                  leftIcon={<BoltIcon className="w-5 h-5" />}
                  onClick={() => {
                    postNowRef.current = true;
                    setIsPostingNow(true);
                    handleSubmit(onSubmit)();
                  }}
                >
                  Post Now
                </Button>
                <HelpButton
                  size="md"
                  title="Post Now"
                  body={destinations
                    ? <>Publishes to <strong>{destinations}</strong>{' '}
                        <strong>straight away</strong>, without waiting for the scheduled time.</>
                    : <>Publishes straight away, without waiting for the scheduled time.{' '}
                        <strong>Choose a platform first.</strong></>}
                  warning={destinations
                    ? <>The post goes <strong>live on {destinations}</strong> immediately.</>
                    : undefined}
                />
              </div>
              <Button type="button" variant="secondary" fullWidth onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </form>

    </div>
  );
}

export default CreatePostPage;
