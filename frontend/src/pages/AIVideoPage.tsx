import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  VideoCameraIcon,
  SparklesIcon,
  Cog6ToothIcon,
  ClockIcon,
  BookmarkIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  XMarkIcon,
  PlayIcon,
  FilmIcon,
  AdjustmentsHorizontalIcon,
  StarIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  TrashIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon, StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { formatDistanceToNow } from 'date-fns';
import { Button, Card, Input, Textarea, Modal, Spinner } from '../components/ui';
import type {
  VideoGeneration,
  SavedVideo,
  VideoLogo,
  VideoPromptTemplate,
  VideoStyle,
  VideoDuration,
  VideoResolution,
  AspectRatio,
  VideoFPS,
  CameraMotion,
  MotionIntensity,
  LogoPosition,
  GenerationStatus,
} from '../types';
import { authFetch } from '../services/api';
import { PromptInfoButton } from '../components/ui/PromptInfoButton';
import { DiamondCostIndicator } from '../components/diamond';

// Style options
const styles: { id: VideoStyle; label: string }[] = [
  { id: 'realistic', label: 'Realistic' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'anime', label: 'Anime' },
  { id: 'cartoon', label: 'Cartoon' },
  { id: '3d_animation', label: '3D Animation' },
  { id: 'stop_motion', label: 'Stop Motion' },
  { id: 'documentary', label: 'Documentary' },
  { id: 'music_video', label: 'Music Video' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'vlog', label: 'Vlog' },
  { id: 'timelapse', label: 'Timelapse' },
  { id: 'slow_motion', label: 'Slow Motion' },
  { id: 'abstract', label: 'Abstract' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'futuristic', label: 'Futuristic' },
];

// Duration options
const durations: { id: VideoDuration; label: string }[] = [
  { id: 3, label: '3 seconds' },
  { id: 5, label: '5 seconds' },
  { id: 8, label: '8 seconds' },
  { id: 10, label: '10 seconds' },
  { id: 15, label: '15 seconds' },
  { id: 30, label: '30 seconds' },
];

// Resolution options
const resolutions: { id: VideoResolution; label: string; description: string }[] = [
  { id: '480p', label: '480p', description: 'SD' },
  { id: '720p', label: '720p', description: 'HD' },
  { id: '1080p', label: '1080p', description: 'Full HD' },
  { id: '4k', label: '4K', description: 'Ultra HD' },
];

// Aspect ratio options
const aspectRatios: { id: AspectRatio; label: string; description: string }[] = [
  { id: '16:9', label: '16:9', description: 'Landscape' },
  { id: '9:16', label: '9:16', description: 'Portrait/Story' },
  { id: '1:1', label: '1:1', description: 'Square' },
  { id: '4:3', label: '4:3', description: 'Classic' },
  { id: '21:9', label: '21:9', description: 'Cinematic' },
];

// FPS options
const fpsOptions: { id: VideoFPS; label: string }[] = [
  { id: 24, label: '24 fps (Cinematic)' },
  { id: 30, label: '30 fps (Standard)' },
  { id: 60, label: '60 fps (Smooth)' },
];

// Camera motion options
const cameraMotions: { id: CameraMotion; label: string }[] = [
  { id: 'static', label: 'Static' },
  { id: 'pan_left', label: 'Pan Left' },
  { id: 'pan_right', label: 'Pan Right' },
  { id: 'tilt_up', label: 'Tilt Up' },
  { id: 'tilt_down', label: 'Tilt Down' },
  { id: 'zoom_in', label: 'Zoom In' },
  { id: 'zoom_out', label: 'Zoom Out' },
  { id: 'dolly_in', label: 'Dolly In' },
  { id: 'dolly_out', label: 'Dolly Out' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'crane', label: 'Crane' },
  { id: 'handheld', label: 'Handheld' },
];

// Motion intensity options
const motionIntensities: { id: MotionIntensity; label: string }[] = [
  { id: 'subtle', label: 'Subtle' },
  { id: 'gentle', label: 'Gentle' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'dynamic', label: 'Dynamic' },
  { id: 'extreme', label: 'Extreme' },
];

// Logo positions
const logoPositions: { id: LogoPosition; label: string }[] = [
  { id: 'none', label: 'No Logo' },
  { id: 'top_left', label: 'Top Left' },
  { id: 'top_right', label: 'Top Right' },
  { id: 'bottom_left', label: 'Bottom Left' },
  { id: 'bottom_right', label: 'Bottom Right' },
];

type TabType = 'generate' | 'history' | 'saved' | 'logos' | 'templates' | 'settings';

export function AIVideoPage() {
  const [activeTab, setActiveTab] = useState<TabType>('generate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<VideoGeneration | null>(null);
  const [history, setHistory] = useState<VideoGeneration[]>([]);
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [logos, setLogos] = useState<VideoLogo[]>([]);
  const [templates, setTemplates] = useState<VideoPromptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreview, setShowPreview] = useState<VideoGeneration | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<VideoStyle>('cinematic');
  const [selectedDuration, setSelectedDuration] = useState<VideoDuration>(5);
  const [selectedResolution, setSelectedResolution] = useState<VideoResolution>('1080p');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>('16:9');
  const [selectedFPS, setSelectedFPS] = useState<VideoFPS>(30);
  const [selectedLogo, setSelectedLogo] = useState<number | null>(null);
  const [logoPosition, setLogoPosition] = useState<LogoPosition>('none');
  const [logoSize, setLogoSize] = useState(10);
  const [logoOpacity, _setLogoOpacity] = useState(100);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [enhancePrompt, setEnhancePrompt] = useState(true);
  const [selectedCameraMotion, setSelectedCameraMotion] = useState<CameraMotion | undefined>(undefined);
  const [selectedMotionIntensity, setSelectedMotionIntensity] = useState<MotionIntensity | undefined>(undefined);

  // Reference image state
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);

  // Error state
  const [error, setError] = useState<string | null>(null);
  const [videoUsedPrompt, setVideoUsedPrompt] = useState('');
  const [videoRegenerating, setVideoRegenerating] = useState(false);

  // Settings state
  const [totalVideosGenerated, setTotalVideosGenerated] = useState(0);
  const [totalDurationGenerated, setTotalDurationGenerated] = useState(0);

  // Logo upload state
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [newLogoName, setNewLogoName] = useState('');
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);

  useEffect(() => {
    if (activeTab === 'generate') fetchLogos();
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'saved') fetchSavedVideos();
    if (activeTab === 'logos') fetchLogos();
    if (activeTab === 'templates') fetchTemplates();
    if (activeTab === 'settings') fetchSettings();
  }, [activeTab]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch('/api/v1/ai-video/history/', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.results || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSavedVideos = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch('/api/v1/ai-video/saved/', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSavedVideos(data.results || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch saved videos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogos = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch('/api/v1/ai-video/logos/', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setLogos(data.results || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch logos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch('/api/v1/ai-video/templates/', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.results || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await authFetch('/api/v1/ai-video/settings/', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTotalVideosGenerated(data.total_videos_generated || 0);
        setTotalDurationGenerated(data.total_duration_generated || 0);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const generateVideo = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedVideo(null);
    try {
      const formData = new FormData();
      formData.append('title', title || 'Untitled');
      formData.append('prompt', prompt);
      if (negativePrompt) formData.append('negative_prompt', negativePrompt);
      formData.append('style', selectedStyle);
      formData.append('duration', String(selectedDuration));
      formData.append('resolution', selectedResolution);
      formData.append('aspect_ratio', selectedAspectRatio);
      formData.append('fps', String(selectedFPS));
      formData.append('enhance_prompt', String(enhancePrompt));

      if (selectedLogo && logoPosition !== 'none') {
        formData.append('logo_id', String(selectedLogo));
        formData.append('logo_position', logoPosition);
        formData.append('logo_size', String(logoSize));
        formData.append('logo_opacity', String(logoOpacity));
      }

      if (referenceImage) formData.append('reference_image', referenceImage);
      if (seed !== undefined) formData.append('seed', String(seed));
      if (selectedCameraMotion) formData.append('camera_motion', selectedCameraMotion);
      if (selectedMotionIntensity) formData.append('motion_intensity', selectedMotionIntensity);

      const response = await authFetch('/api/v1/ai-video/generate/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedVideo(data);
        const usedP = data.used_prompt || data.enhanced_prompt || '';
        if (usedP) setVideoUsedPrompt(usedP);
      } else {
        setError(data.error || 'Failed to generate video');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Failed to generate video:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVideoRegenerate = async (editedPrompt: string) => {
    setVideoRegenerating(true);
    try {
      const formData = new FormData();
      formData.append('title', title || 'Untitled');
      formData.append('prompt', editedPrompt);
      formData.append('style', selectedStyle);
      formData.append('duration', String(selectedDuration));
      formData.append('resolution', selectedResolution);
      formData.append('aspect_ratio', selectedAspectRatio);
      formData.append('fps', String(selectedFPS));
      formData.append('enhance_prompt', 'false');

      const response = await authFetch('/api/v1/ai-video/generate/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setGeneratedVideo(data);
        const usedP = data.used_prompt || data.enhanced_prompt || '';
        if (usedP) setVideoUsedPrompt(usedP);
      }
    } catch { /* keep existing */ }
    setVideoRegenerating(false);
  };

  const uploadLogo = async () => {
    if (!newLogoFile || !newLogoName.trim()) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('name', newLogoName);
      formData.append('logo_file', newLogoFile);

      const response = await authFetch('/api/v1/ai-video/logos/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: formData,
      });

      if (response.ok) {
        setNewLogoName('');
        setNewLogoFile(null);
        fetchLogos();
      }
    } catch (error) {
      console.error('Failed to upload logo:', error);
    } finally {
      setUploadingLogo(false);
    }
  };


  const downloadVideo = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status: GenerationStatus) => {
    const config = {
      pending: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Pending' },
      processing: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Processing' },
      completed: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Completed' },
      failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
    };
    const { bg, text, label } = config[status];
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>{label}</span>;
  };

  const tabs: { id: TabType; label: string; Icon: typeof VideoCameraIcon }[] = [
    { id: 'generate', label: 'Generate', Icon: SparklesIcon },
    { id: 'history', label: 'History', Icon: ClockIcon },
    { id: 'saved', label: 'Saved', Icon: BookmarkIcon },
    { id: 'logos', label: 'Logos', Icon: StarIcon },
    { id: 'templates', label: 'Templates', Icon: DocumentTextIcon },
    { id: 'settings', label: 'Settings', Icon: Cog6ToothIcon },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/25">
          <VideoCameraIcon className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">AI Video Generator</h1>
          <p className="text-text-secondary">Create stunning videos with Google Gemini</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/25'
                : 'bg-dark-700 text-text-secondary hover:text-text-primary hover:bg-dark-600'
            }`}
          >
            <tab.Icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Generate Tab */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & Prompt */}
            <Card>
              <div className="space-y-4">
                <Input
                  label="Title"
                  placeholder="Give your video a name..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Prompt <span className="text-danger">*</span>
                  </label>
                  <Textarea
                    placeholder="Describe the video you want to create in detail..."
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Negative Prompt (what to avoid)
                  </label>
                  <Textarea
                    placeholder="E.g., blurry, low quality, glitches..."
                    rows={2}
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                  />
                </div>
              </div>
            </Card>

            {/* Reference Image */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <PhotoIcon className="w-5 h-5 text-orange-400" />
                <h3 className="font-semibold text-text-primary">Reference Image (Optional)</h3>
              </div>
              <p className="text-xs text-text-muted mb-4">
                Upload an image to animate into a video. The AI will use it as a starting frame.
              </p>

              {referencePreview ? (
                <div className="relative inline-block w-full">
                  <img
                    src={referencePreview}
                    alt="Reference preview"
                    className="w-full max-h-48 object-contain rounded-xl border border-white/10"
                  />
                  <button
                    onClick={() => {
                      setReferenceImage(null);
                      setReferencePreview(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-danger/80 rounded-lg hover:bg-danger transition-colors"
                  >
                    <TrashIcon className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-orange-500/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setReferenceImage(file);
                        setReferencePreview(URL.createObjectURL(file));
                      }
                    }}
                    className="hidden"
                  />
                  <CloudArrowUpIcon className="w-10 h-10 text-text-muted" />
                  <span className="text-sm text-text-secondary">Click to upload reference image</span>
                </label>
              )}
            </Card>

            {/* Style Selection */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <FilmIcon className="w-5 h-5 text-red-400" />
                <h3 className="font-semibold text-text-primary">Style</h3>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {styles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      selectedStyle === style.id
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <p className="text-xs font-medium text-text-primary">{style.label}</p>
                  </button>
                ))}
              </div>
            </Card>

            {/* Duration, Resolution, Aspect Ratio */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <Card>
                <h3 className="font-semibold text-text-primary mb-3">Duration</h3>
                <div className="space-y-2">
                  {durations.map((d) => (
                    <label
                      key={d.id}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        selectedDuration === d.id
                          ? 'bg-red-500/10 border border-red-500/30'
                          : 'bg-dark-700/50 border border-transparent hover:bg-dark-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="duration"
                        checked={selectedDuration === d.id}
                        onChange={() => setSelectedDuration(d.id)}
                        className="w-4 h-4 text-red-500 bg-dark-600 border-white/20"
                      />
                      <span className="text-sm text-text-primary">{d.label}</span>
                    </label>
                  ))}
                </div>
              </Card>

              <Card>
                <h3 className="font-semibold text-text-primary mb-3">Resolution</h3>
                <div className="space-y-2">
                  {resolutions.map((r) => (
                    <label
                      key={r.id}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                        selectedResolution === r.id
                          ? 'bg-red-500/10 border border-red-500/30'
                          : 'bg-dark-700/50 border border-transparent hover:bg-dark-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="resolution"
                          checked={selectedResolution === r.id}
                          onChange={() => setSelectedResolution(r.id)}
                          className="w-4 h-4 text-red-500 bg-dark-600 border-white/20"
                        />
                        <span className="text-sm text-text-primary">{r.label}</span>
                      </div>
                      <span className="text-xs text-text-muted">{r.description}</span>
                    </label>
                  ))}
                </div>
              </Card>

              <Card>
                <h3 className="font-semibold text-text-primary mb-3">Aspect Ratio</h3>
                <div className="space-y-2">
                  {aspectRatios.map((ar) => (
                    <label
                      key={ar.id}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                        selectedAspectRatio === ar.id
                          ? 'bg-red-500/10 border border-red-500/30'
                          : 'bg-dark-700/50 border border-transparent hover:bg-dark-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="aspect"
                          checked={selectedAspectRatio === ar.id}
                          onChange={() => setSelectedAspectRatio(ar.id)}
                          className="w-4 h-4 text-red-500 bg-dark-600 border-white/20"
                        />
                        <span className="text-sm text-text-primary">{ar.label}</span>
                      </div>
                      <span className="text-xs text-text-muted">{ar.description}</span>
                    </label>
                  ))}
                </div>
              </Card>
            </div>

            {/* FPS */}
            <Card>
              <h3 className="font-semibold text-text-primary mb-3">Frame Rate</h3>
              <div className="grid grid-cols-3 gap-3">
                {fpsOptions.map((fps) => (
                  <button
                    key={fps.id}
                    onClick={() => setSelectedFPS(fps.id)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      selectedFPS === fps.id
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <p className="text-sm font-medium text-text-primary">{fps.label}</p>
                  </button>
                ))}
              </div>
            </Card>

            {/* Advanced Options Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              <AdjustmentsHorizontalIcon className="w-5 h-5" />
              <span>Advanced Options</span>
              <motion.span animate={{ rotate: showAdvanced ? 180 : 0 }}>
                <XMarkIcon className="w-4 h-4" />
              </motion.span>
            </button>

            {/* Advanced Options */}
            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-6"
                >
                  {/* Camera Motion */}
                  <Card>
                    <h3 className="font-semibold text-text-primary mb-3">Camera Motion</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {cameraMotions.map((motion) => (
                        <button
                          key={motion.id}
                          onClick={() => setSelectedCameraMotion(
                            selectedCameraMotion === motion.id ? undefined : motion.id
                          )}
                          className={`p-2 rounded-lg border transition-all text-sm ${
                            selectedCameraMotion === motion.id
                              ? 'border-red-500 bg-red-500/10 text-red-400'
                              : 'border-white/10 text-text-secondary hover:border-white/20'
                          }`}
                        >
                          {motion.label}
                        </button>
                      ))}
                    </div>
                  </Card>

                  {/* Motion Intensity */}
                  {selectedCameraMotion && (
                    <Card>
                      <h3 className="font-semibold text-text-primary mb-3">Motion Intensity</h3>
                      <div className="grid grid-cols-5 gap-2">
                        {motionIntensities.map((intensity) => (
                          <button
                            key={intensity.id}
                            onClick={() => setSelectedMotionIntensity(intensity.id)}
                            className={`p-2 rounded-lg border transition-all text-sm ${
                              selectedMotionIntensity === intensity.id
                                ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                                : 'border-white/10 text-text-secondary hover:border-white/20'
                            }`}
                          >
                            {intensity.label}
                          </button>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Logo Options */}
                  {logos.length > 0 && (
                    <Card>
                      <div className="flex items-center gap-3 mb-4">
                        <StarIcon className="w-5 h-5 text-amber-400" />
                        <h3 className="font-semibold text-text-primary">Logo Watermark</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-2">
                          {logos.map((logo) => (
                            <button
                              key={logo.id}
                              onClick={() => setSelectedLogo(logo.id)}
                              className={`p-2 rounded-xl border-2 transition-all ${
                                selectedLogo === logo.id
                                  ? 'border-amber-500 bg-amber-500/10'
                                  : 'border-white/10 hover:border-white/20'
                              }`}
                            >
                              <img src={logo.logo_file} alt={logo.name} className="w-full h-12 object-contain" />
                            </button>
                          ))}
                        </div>

                        {selectedLogo && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-text-secondary mb-2">Position</label>
                              <select
                                value={logoPosition}
                                onChange={(e) => setLogoPosition(e.target.value as LogoPosition)}
                                className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-xl text-text-primary"
                              >
                                {logoPositions.map((pos) => (
                                  <option key={pos.id} value={pos.id}>{pos.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm text-text-secondary mb-2">Size: {logoSize}%</label>
                              <input
                                type="range"
                                min="5"
                                max="25"
                                value={logoSize}
                                onChange={(e) => setLogoSize(Number(e.target.value))}
                                className="w-full"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}

                  {/* Other Options */}
                  <Card>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-text-secondary mb-2">Seed</label>
                        <Input
                          type="number"
                          placeholder="Random"
                          value={seed || ''}
                          onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-dark-700/50 rounded-xl">
                        <div>
                          <p className="text-text-primary font-medium">Enhance Prompt</p>
                          <p className="text-xs text-text-muted">AI improves your prompt</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={enhancePrompt}
                          onChange={(e) => setEnhancePrompt(e.target.checked)}
                          className="w-5 h-5 rounded text-red-500 bg-dark-600 border-white/20"
                        />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Generate Button */}
            <Button
              fullWidth
              size="lg"
              onClick={generateVideo}
              isLoading={isGenerating}
              disabled={!prompt.trim()}
              leftIcon={<SparklesIcon className="w-5 h-5" />}
              className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
            >
              Generate Video <DiamondCostIndicator cost={500} className="ml-2" />
            </Button>
          </div>

          {/* Result Section */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text-primary flex items-center gap-2">
                  Generated Video
                  {videoUsedPrompt && <PromptInfoButton prompt={videoUsedPrompt} label="Video Generation Prompt" onRegenerate={handleVideoRegenerate} regenerating={videoRegenerating} regenerateLabel="Regenerate Video" />}
                </h3>
                {generatedVideo?.generated_video && (
                  <button
                    onClick={() => downloadVideo(generatedVideo.generated_video!, `${title || 'video'}.mp4`)}
                    className="p-2 rounded-lg hover:bg-dark-600 transition-colors"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5 text-text-muted" />
                  </button>
                )}
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Spinner size="lg" />
                  <p className="mt-4 text-text-secondary">Generating your video...</p>
                  <p className="text-xs text-text-muted mt-2">This may take several minutes</p>
                </div>
              ) : generatedVideo?.generated_video ? (
                <div className="space-y-4">
                  <div className="rounded-xl overflow-hidden bg-dark-700">
                    <video
                      src={generatedVideo.generated_video}
                      controls
                      className="w-full"
                      poster={generatedVideo.thumbnail}
                    />
                  </div>

                  {generatedVideo.enhanced_prompt && (
                    <div>
                      <p className="text-sm text-text-secondary mb-2">Enhanced Prompt</p>
                      <div className="p-3 bg-red-500/10 rounded-xl">
                        <p className="text-red-300 text-sm">{generatedVideo.enhanced_prompt}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/5">
                    <div className="text-center">
                      <p className="text-sm font-bold text-text-primary">{selectedDuration}s</p>
                      <p className="text-xs text-text-muted">Duration</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-text-primary">{selectedResolution}</p>
                      <p className="text-xs text-text-muted">Resolution</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-text-primary">
                        {formatFileSize(generatedVideo.file_size || 0)}
                      </p>
                      <p className="text-xs text-text-muted">Size</p>
                    </div>
                  </div>

                  {generatedVideo.processing_time != null && (
                    <div className="text-center pt-2">
                      <p className="text-xs text-text-muted">Generated in {(generatedVideo.processing_time || 0).toFixed(1)}s</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-dark-600 flex items-center justify-center mb-4">
                    <VideoCameraIcon className="w-8 h-8 text-text-muted" />
                  </div>
                  <p className="text-text-secondary">Your generated video will appear here</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div>
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : history.length === 0 ? (
            <Card padding="lg" className="text-center">
              <ClockIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">No History Yet</h3>
              <p className="text-text-secondary">Generated videos will appear here</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((item) => (
                <Card key={item.id} padding="none" className="overflow-hidden group">
                  <div className="aspect-video bg-dark-700 relative">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <VideoCameraIcon className="w-12 h-12 text-text-muted" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2">{getStatusBadge(item.status)}</div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => setShowPreview(item)}
                        className="p-3 bg-white/20 rounded-full hover:bg-white/30"
                      >
                        <PlayIcon className="w-6 h-6 text-white" />
                      </button>
                    </div>
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded-lg text-xs text-white">
                      {item.duration}s
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="font-medium text-text-primary truncate">{item.title}</p>
                    <p className="text-sm text-text-muted mt-1">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Saved Tab */}
      {activeTab === 'saved' && (
        <div>
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : savedVideos.length === 0 ? (
            <Card padding="lg" className="text-center">
              <BookmarkIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">No Saved Videos</h3>
              <p className="text-text-secondary">Save your favorite videos for quick access</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedVideos.map((item) => (
                <Card key={item.id} padding="none" className="overflow-hidden group">
                  <div className="aspect-video bg-dark-700 relative">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <VideoCameraIcon className="w-12 h-12 text-text-muted" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      {item.is_favorite && <HeartSolidIcon className="w-5 h-5 text-danger" />}
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button className="p-3 bg-white/20 rounded-full hover:bg-white/30">
                        <PlayIcon className="w-6 h-6 text-white" />
                      </button>
                    </div>
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded-lg text-xs text-white">
                      {item.duration}s
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="font-medium text-text-primary truncate">{item.title}</p>
                    <p className="text-sm text-text-muted mt-1">Downloaded {item.download_count} times</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Logos Tab */}
      {activeTab === 'logos' && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Upload New Logo</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                placeholder="Logo name"
                value={newLogoName}
                onChange={(e) => setNewLogoName(e.target.value)}
              />
              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-red-500/50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewLogoFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <CloudArrowUpIcon className="w-5 h-5 text-text-muted" />
                <span className="text-sm text-text-secondary">
                  {newLogoFile ? newLogoFile.name : 'Select file'}
                </span>
              </label>
              <Button
                onClick={uploadLogo}
                isLoading={uploadingLogo}
                disabled={!newLogoName.trim() || !newLogoFile}
                leftIcon={<PlusIcon className="w-5 h-5" />}
              >
                Upload Logo
              </Button>
            </div>
          </Card>

          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : logos.length === 0 ? (
            <Card padding="lg" className="text-center">
              <StarIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">No Logos Yet</h3>
              <p className="text-text-secondary">Upload logos to add watermarks to your videos</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {logos.map((logo) => (
                <Card key={logo.id} padding="sm" className="group relative">
                  <div className="aspect-square bg-dark-700 rounded-lg flex items-center justify-center p-4 mb-2">
                    <img src={logo.logo_file} alt={logo.name} className="max-w-full max-h-full object-contain" />
                  </div>
                  <p className="text-sm font-medium text-text-primary truncate">{logo.name}</p>
                  {logo.is_default && <span className="text-xs text-amber-400">Default</span>}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary">Video Templates</h3>
            <Button leftIcon={<PlusIcon className="w-5 h-5" />} size="sm">Create Template</Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : templates.length === 0 ? (
            <Card padding="lg" className="text-center">
              <DocumentTextIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">No Templates Yet</h3>
              <p className="text-text-secondary mb-4">Create reusable video prompt templates</p>
              <Button leftIcon={<PlusIcon className="w-5 h-5" />}>Create Template</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="hover:border-white/20 transition-colors">
                  {template.preview_thumbnail && (
                    <div className="aspect-video rounded-lg overflow-hidden bg-dark-700 mb-4">
                      <img src={template.preview_thumbnail} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs capitalize">
                      {template.category}
                    </span>
                    {template.is_global && <StarSolidIcon className="w-4 h-4 text-amber-400" />}
                  </div>
                  <h4 className="font-semibold text-text-primary mb-2">{template.name}</h4>
                  <p className="text-text-secondary text-sm line-clamp-2 mb-4">{template.prompt_template}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted capitalize">{template.recommended_style}</span>
                      <span className="text-xs text-text-muted">{template.recommended_duration}s</span>
                    </div>
                    <Button size="sm" variant="secondary">Use</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl space-y-6">
          {/* Info: API keys managed by admin */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <CheckCircleIcon className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">AI Service Active</h3>
                <p className="text-sm text-text-secondary">API keys are managed by your administrator</p>
              </div>
            </div>
            <p className="text-xs text-text-muted">
              All AI features are powered by Diamond Tokens. Contact your admin for API configuration.
            </p>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Usage Statistics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-dark-700/50 rounded-xl text-center">
                <p className="text-2xl font-bold text-red-400">{totalVideosGenerated}</p>
                <p className="text-sm text-text-muted">Videos Generated</p>
              </div>
              <div className="p-4 bg-dark-700/50 rounded-xl text-center">
                <p className="text-2xl font-bold text-orange-400">{totalDurationGenerated}s</p>
                <p className="text-sm text-text-muted">Total Duration</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Preview Modal */}
      <Modal isOpen={!!showPreview} onClose={() => setShowPreview(null)} title="Video Details" size="xl">
        {showPreview && (
          <div className="space-y-4">
            {showPreview.generated_video && (
              <div className="rounded-xl overflow-hidden bg-dark-700">
                <video
                  src={showPreview.generated_video}
                  controls
                  className="w-full"
                  poster={showPreview.thumbnail}
                />
              </div>
            )}
            <div>
              <h4 className="font-semibold text-text-primary mb-2">{showPreview.title}</h4>
              <p className="text-text-secondary text-sm">{showPreview.prompt}</p>
            </div>
            <div className="grid grid-cols-4 gap-3 pt-4 border-t border-white/5">
              <div className="p-3 bg-dark-700/50 rounded-xl text-center">
                <p className="text-sm font-medium text-text-primary capitalize">{showPreview.style}</p>
                <p className="text-xs text-text-muted">Style</p>
              </div>
              <div className="p-3 bg-dark-700/50 rounded-xl text-center">
                <p className="text-sm font-medium text-text-primary">{showPreview.duration}s</p>
                <p className="text-xs text-text-muted">Duration</p>
              </div>
              <div className="p-3 bg-dark-700/50 rounded-xl text-center">
                <p className="text-sm font-medium text-text-primary">{showPreview.resolution}</p>
                <p className="text-xs text-text-muted">Resolution</p>
              </div>
              <div className="p-3 bg-dark-700/50 rounded-xl text-center">
                <p className="text-sm font-medium text-text-primary">{formatFileSize(showPreview.file_size || 0)}</p>
                <p className="text-xs text-text-muted">Size</p>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              {showPreview.generated_video && (
                <Button
                  fullWidth
                  onClick={() => downloadVideo(showPreview.generated_video!, `${showPreview.title}.mp4`)}
                  leftIcon={<ArrowDownTrayIcon className="w-5 h-5" />}
                >
                  Download
                </Button>
              )}
              <Button variant="secondary" onClick={() => setShowPreview(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default AIVideoPage;
