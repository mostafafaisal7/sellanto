import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  SparklesIcon,
  PhotoIcon,
  VideoCameraIcon,
  ClipboardDocumentIcon,
  BookmarkIcon,
  ClockIcon,
  Cog6ToothIcon,
  CheckIcon,
  XMarkIcon,
  HashtagIcon,
  FaceSmileIcon,
  MegaphoneIcon,
  DocumentTextIcon,
  TrashIcon,
  HeartIcon,
  EyeIcon,
  PlusIcon,
  BriefcaseIcon,
  ChatBubbleLeftRightIcon,
  FireIcon,
  LightBulbIcon,
  AcademicCapIcon,
  UserIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon, StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { format, formatDistanceToNow } from 'date-fns';
import { Button, Card, Textarea, Modal, Spinner, PlatformIcon } from '../components/ui';
import type { CaptionGeneration, CaptionTemplate, SavedCaption, CaptionTone, CaptionLength, CaptionPlatform, TemplateCategory, GenerationStatus } from '../types';
import { authFetch } from '../services/api';
import { PromptInfoButton } from '../components/ui/PromptInfoButton';
import { DiamondCostIndicator } from '../components/diamond';
import { toast } from '../store/toastStore';

// Tone options with icons
const tones: { id: CaptionTone; label: string; Icon: typeof BriefcaseIcon; description: string }[] = [
  { id: 'professional', label: 'Professional', Icon: BriefcaseIcon, description: 'Business-appropriate tone' },
  { id: 'casual', label: 'Casual', Icon: ChatBubbleLeftRightIcon, description: 'Relaxed, everyday language' },
  { id: 'friendly', label: 'Friendly', Icon: HeartIcon, description: 'Warm and approachable' },
  { id: 'enthusiastic', label: 'Enthusiastic', Icon: FireIcon, description: 'Energetic and excited' },
  { id: 'humorous', label: 'Humorous', Icon: FaceSmileIcon, description: 'Fun and witty' },
  { id: 'inspirational', label: 'Inspirational', Icon: LightBulbIcon, description: 'Motivating and uplifting' },
  { id: 'formal', label: 'Formal', Icon: AcademicCapIcon, description: 'Official and structured' },
  { id: 'conversational', label: 'Conversational', Icon: UserIcon, description: 'Natural dialogue style' },
];

// Length options
const lengths: { id: CaptionLength; label: string; chars: string }[] = [
  { id: 'short', label: 'Short', chars: '~50 chars' },
  { id: 'medium', label: 'Medium', chars: '~150 chars' },
  { id: 'long', label: 'Long', chars: '~300 chars' },
  { id: 'extra_long', label: 'Extra Long', chars: '500+ chars' },
];

// Platform options
const platforms: { id: CaptionPlatform; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'twitter', label: 'Twitter/X' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'pinterest', label: 'Pinterest' },
];

// Template categories - exported for potential use in other components
export const templateCategories: { id: TemplateCategory; label: string }[] = [
  { id: 'product', label: 'Product Launch' },
  { id: 'promotion', label: 'Promotion' },
  { id: 'event', label: 'Event' },
  { id: 'announcement', label: 'Announcement' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'educational', label: 'Educational' },
  { id: 'behind_scenes', label: 'Behind the Scenes' },
  { id: 'testimonial', label: 'Testimonial' },
  { id: 'holiday', label: 'Holiday' },
  { id: 'motivational', label: 'Motivational' },
];

type TabType = 'generate' | 'history' | 'saved' | 'templates' | 'settings';

function formatProvider(p?: string): string {
  if (!p) return '';
  const map: Record<string, string> = { openai: 'OpenAI', gemini: 'Gemini', claude: 'Claude' };
  return map[p] || p;
}
function formatModel(m?: string): string {
  if (!m) return '';
  const known: Record<string, string> = {
    'dall-e-3': 'DALL-E 3', 'dall-e-2': 'DALL-E 2',
    'gpt-image-1.5': 'GPT Image 1.5',
  };
  if (known[m]) return known[m];
  const parts = m.replace(/-\d{8,}$/, '').split('-');
  if (['claude', 'gemini', 'gpt'].includes(parts[0])) parts.shift();
  return parts.join(' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\s+/g, ' ').trim();
}

export function AICaptionPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('generate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCaption, setGeneratedCaption] = useState<CaptionGeneration | null>(null);
  const [history, setHistory] = useState<CaptionGeneration[]>([]);
  const [savedCaptions, setSavedCaptions] = useState<SavedCaption[]>([]);
  const [templates, setTemplates] = useState<CaptionTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState<CaptionGeneration | null>(null);
  const [captionUsedPrompt, setCaptionUsedPrompt] = useState('');
  const [captionRegenerating, setCaptionRegenerating] = useState(false);

  // Form state
  const [inputText, setInputText] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState<CaptionTone>('professional');
  const [selectedLength, setSelectedLength] = useState<CaptionLength>('medium');
  const [selectedPlatform, setSelectedPlatform] = useState<CaptionPlatform>('general');
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [includeEmojis, setIncludeEmojis] = useState(true);
  const [includeCta, setIncludeCta] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');

  // Settings state
  const [totalTokensUsed, setTotalTokensUsed] = useState(0);
  const [totalGenerations, setTotalGenerations] = useState(0);

  // Fetch data on mount
  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'saved') fetchSavedCaptions();
    if (activeTab === 'templates') fetchTemplates();
    if (activeTab === 'settings') fetchSettings();
  }, [activeTab]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch('/api/v1/ai-caption/history/', {
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

  const fetchSavedCaptions = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch('/api/v1/ai-caption/saved/', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSavedCaptions(data.results || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch saved captions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch('/api/v1/ai-caption/templates/', {
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
      const response = await authFetch('/api/v1/ai-caption/settings/', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTotalTokensUsed(data.total_tokens_used || 0);
        setTotalGenerations(data.total_generations || 0);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const removeMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
  };

  const generateCaption = async () => {
    if (!inputText.trim() && !mediaFile) return;

    setIsGenerating(true);
    setError('');
    setGeneratedCaption(null);
    try {
      const formData = new FormData();
      if (inputText) formData.append('input_text', inputText);
      if (mediaFile) formData.append('media_file', mediaFile);
      formData.append('tone', selectedTone);
      formData.append('length', selectedLength);
      formData.append('platform', selectedPlatform);
      formData.append('include_hashtags', String(includeHashtags));
      formData.append('include_emojis', String(includeEmojis));
      formData.append('include_cta', String(includeCta));
      if (customInstructions) formData.append('custom_instructions', customInstructions);

      const response = await authFetch('/api/v1/ai-caption/generate/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setGeneratedCaption(data);
        if (data.used_prompt) setCaptionUsedPrompt(data.used_prompt);
        toast.success('Caption generated successfully!');
      } else {
        setError(data.error || 'Failed to generate caption. Please check your API key in Settings.');
      }
    } catch (err) {
      console.error('Failed to generate caption:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCaptionRegenerate = async (editedPrompt: string) => {
    if (!inputText.trim() && !mediaFile) return;
    setCaptionRegenerating(true);
    try {
      const formData = new FormData();
      if (inputText) formData.append('input_text', inputText);
      if (mediaFile) formData.append('media_file', mediaFile);
      formData.append('tone', selectedTone);
      formData.append('length', selectedLength);
      formData.append('platform', selectedPlatform);
      formData.append('include_hashtags', String(includeHashtags));
      formData.append('include_emojis', String(includeEmojis));
      formData.append('include_cta', String(includeCta));
      if (customInstructions) formData.append('custom_instructions', customInstructions);
      formData.append('override_prompt', editedPrompt);

      const response = await authFetch('/api/v1/ai-caption/generate/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setGeneratedCaption(data);
        if (data.used_prompt) setCaptionUsedPrompt(data.used_prompt);
      }
    } catch { /* keep existing */ }
    setCaptionRegenerating(false);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveCaption = async (caption: CaptionGeneration) => {
    try {
      const response = await authFetch('/api/v1/ai-caption/saved/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caption_generation: caption.id,
          caption_text: caption.generated_caption,
          hashtags: caption.generated_hashtags,
        }),
      });
      if (response.ok) {
        fetchSavedCaptions();
        toast.success('Caption saved!');
      }
    } catch (error) {
      console.error('Failed to save caption:', error);
    }
  };

  const toggleFavorite = async (id: number, isFavorite: boolean) => {
    try {
      await authFetch(`/api/v1/ai-caption/saved/${id}/`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_favorite: !isFavorite }),
      });
      fetchSavedCaptions();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const deleteSaved = async (id: number) => {
    try {
      await authFetch(`/api/v1/ai-caption/saved/${id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      fetchSavedCaptions();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };


  const getStatusBadge = (status: GenerationStatus) => {
    const config = {
      pending: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Pending' },
      processing: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Processing' },
      completed: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Completed' },
      failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
    };
    const { bg, text, label } = config[status];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
        {label}
      </span>
    );
  };

  const tabs: { id: TabType; label: string; Icon: typeof SparklesIcon }[] = [
    { id: 'generate', label: 'Generate', Icon: SparklesIcon },
    { id: 'history', label: 'History', Icon: ClockIcon },
    { id: 'saved', label: 'Saved', Icon: BookmarkIcon },
    { id: 'templates', label: 'Templates', Icon: DocumentTextIcon },
    { id: 'settings', label: 'Settings', Icon: Cog6ToothIcon },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
          <SparklesIcon className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">AI Caption Generator</h1>
          <p className="text-text-secondary">Create engaging captions powered by GPT-4</p>
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
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25'
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
            {/* Topic/Input */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <DocumentTextIcon className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">What's your caption about?</h2>
                  <p className="text-sm text-text-secondary">Describe your post topic or key message</p>
                </div>
              </div>
              <Textarea
                placeholder="E.g., Launching our new summer collection with vibrant colors and sustainable materials..."
                rows={4}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </Card>

            {/* Media Upload */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <PhotoIcon className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Media Analysis</h2>
                  <p className="text-sm text-text-secondary">Upload an image or video for AI to analyze (optional)</p>
                </div>
              </div>

              {!mediaPreview ? (
                <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleMediaSelect}
                    className="hidden"
                  />
                  <div className="w-16 h-16 rounded-2xl bg-dark-600 flex items-center justify-center mb-4">
                    <PhotoIcon className="w-8 h-8 text-text-muted" />
                  </div>
                  <p className="text-text-primary font-medium">Drop media here or click to upload</p>
                  <p className="text-sm text-text-muted mt-1">AI will analyze and describe your content</p>
                  <div className="flex items-center gap-4 mt-4 text-text-muted text-sm">
                    <span className="flex items-center gap-1">
                      <PhotoIcon className="w-4 h-4" /> Images
                    </span>
                    <span className="flex items-center gap-1">
                      <VideoCameraIcon className="w-4 h-4" /> Videos
                    </span>
                  </div>
                </label>
              ) : (
                <div className="relative">
                  <div className="aspect-video rounded-xl overflow-hidden bg-dark-700">
                    {mediaFile?.type.startsWith('video/') ? (
                      <video src={mediaPreview} className="w-full h-full object-cover" controls />
                    ) : (
                      <img src={mediaPreview} alt="Upload preview" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <button
                    onClick={removeMedia}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-danger rounded-full flex items-center justify-center transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5 text-white" />
                  </button>
                </div>
              )}
            </Card>

            {/* Tone Selection */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <ChatBubbleLeftRightIcon className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Select Tone</h2>
                  <p className="text-sm text-text-secondary">Choose the voice for your caption</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {tones.map((tone) => (
                  <motion.button
                    key={tone.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedTone(tone.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedTone === tone.id
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <tone.Icon className={`w-6 h-6 mb-2 ${selectedTone === tone.id ? 'text-purple-400' : 'text-text-muted'}`} />
                    <p className="font-medium text-text-primary text-sm">{tone.label}</p>
                    <p className="text-xs text-text-muted mt-1 line-clamp-1">{tone.description}</p>
                  </motion.button>
                ))}
              </div>
            </Card>

            {/* Options Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Length */}
              <Card>
                <h3 className="font-semibold text-text-primary mb-3">Caption Length</h3>
                <div className="space-y-2">
                  {lengths.map((length) => (
                    <label
                      key={length.id}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                        selectedLength === length.id
                          ? 'bg-purple-500/10 border border-purple-500/30'
                          : 'bg-dark-700/50 border border-transparent hover:bg-dark-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="length"
                          checked={selectedLength === length.id}
                          onChange={() => setSelectedLength(length.id)}
                          className="w-4 h-4 text-purple-500 bg-dark-600 border-white/20 focus:ring-purple-500/50"
                        />
                        <span className="text-text-primary">{length.label}</span>
                      </div>
                      <span className="text-xs text-text-muted">{length.chars}</span>
                    </label>
                  ))}
                </div>
              </Card>

              {/* Platform */}
              <Card>
                <h3 className="font-semibold text-text-primary mb-3">Target Platform</h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {platforms.map((platform) => (
                    <label
                      key={platform.id}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        selectedPlatform === platform.id
                          ? 'bg-purple-500/10 border border-purple-500/30'
                          : 'bg-dark-700/50 border border-transparent hover:bg-dark-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="platform"
                        checked={selectedPlatform === platform.id}
                        onChange={() => setSelectedPlatform(platform.id)}
                        className="w-4 h-4 text-purple-500 bg-dark-600 border-white/20 focus:ring-purple-500/50"
                      />
                      {platform.id !== 'general' ? (
                        <PlatformIcon platform={platform.id as any} size="sm" />
                      ) : (
                        <div className="w-5 h-5 rounded bg-gray-500 flex items-center justify-center">
                          <SparklesIcon className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <span className="text-text-primary">{platform.label}</span>
                    </label>
                  ))}
                </div>
              </Card>
            </div>

            {/* Toggles */}
            <Card>
              <h3 className="font-semibold text-text-primary mb-4">Additional Options</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="flex items-center justify-between p-4 bg-dark-700/50 rounded-xl cursor-pointer hover:bg-dark-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <HashtagIcon className="w-5 h-5 text-blue-400" />
                    <span className="text-text-primary">Hashtags</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeHashtags}
                    onChange={(e) => setIncludeHashtags(e.target.checked)}
                    className="w-5 h-5 rounded text-purple-500 bg-dark-600 border-white/20 focus:ring-purple-500/50"
                  />
                </label>
                <label className="flex items-center justify-between p-4 bg-dark-700/50 rounded-xl cursor-pointer hover:bg-dark-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <FaceSmileIcon className="w-5 h-5 text-yellow-400" />
                    <span className="text-text-primary">Emojis</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeEmojis}
                    onChange={(e) => setIncludeEmojis(e.target.checked)}
                    className="w-5 h-5 rounded text-purple-500 bg-dark-600 border-white/20 focus:ring-purple-500/50"
                  />
                </label>
                <label className="flex items-center justify-between p-4 bg-dark-700/50 rounded-xl cursor-pointer hover:bg-dark-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <MegaphoneIcon className="w-5 h-5 text-green-400" />
                    <span className="text-text-primary">Call-to-Action</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeCta}
                    onChange={(e) => setIncludeCta(e.target.checked)}
                    className="w-5 h-5 rounded text-purple-500 bg-dark-600 border-white/20 focus:ring-purple-500/50"
                  />
                </label>
              </div>
            </Card>

            {/* Custom Instructions */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <DocumentDuplicateIcon className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Custom Instructions</h2>
                  <p className="text-sm text-text-secondary">Add specific requirements (optional)</p>
                </div>
              </div>
              <Textarea
                placeholder="E.g., Include our brand name 'EcoStyle', mention free shipping, keep it under 200 characters..."
                rows={3}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
              />
            </Card>

            {/* Generate Button */}
            <Button
              fullWidth
              size="lg"
              onClick={generateCaption}
              isLoading={isGenerating}
              disabled={!inputText.trim() && !mediaFile}
              leftIcon={<SparklesIcon className="w-5 h-5" />}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              Generate Caption <DiamondCostIndicator cost={5} className="ml-2" />
            </Button>
          </div>

          {/* Result Section */}
          <div className="space-y-6">
            {/* Generated Caption */}
            <Card className="sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text-primary flex items-center gap-2">
                  Generated Caption
                  {captionUsedPrompt && <PromptInfoButton prompt={captionUsedPrompt} label="Caption Generation Prompt" onRegenerate={handleCaptionRegenerate} regenerating={captionRegenerating} regenerateLabel="Regenerate Caption" />}
                </h3>
                {generatedCaption && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(generatedCaption.generated_caption || '')}
                      className="p-2 rounded-lg hover:bg-dark-600 transition-colors"
                      title="Copy"
                    >
                      {copied ? (
                        <CheckIcon className="w-5 h-5 text-success" />
                      ) : (
                        <ClipboardDocumentIcon className="w-5 h-5 text-text-muted" />
                      )}
                    </button>
                    <button
                      onClick={() => saveCaption(generatedCaption)}
                      className="p-2 rounded-lg hover:bg-dark-600 transition-colors"
                      title="Save"
                    >
                      <BookmarkIcon className="w-5 h-5 text-text-muted" />
                    </button>
                    <button
                      onClick={() => {
                        const fullCaption = [
                          generatedCaption.generated_caption,
                          generatedCaption.generated_hashtags,
                        ].filter(Boolean).join('\n\n');
                        navigate('/posts/create', { state: { caption: fullCaption } });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-sm font-medium transition-colors"
                      title="Use in Post"
                    >
                      <PaperAirplaneIcon className="w-4 h-4" />
                      Use in Post
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Spinner size="lg" />
                  <p className="mt-4 text-text-secondary">Generating your caption...</p>
                </div>
              ) : generatedCaption ? (
                <div className="space-y-4">
                  {/* Caption */}
                  <div className="p-4 bg-dark-700/50 rounded-xl">
                    <p className="text-text-primary whitespace-pre-wrap">
                      {generatedCaption.generated_caption}
                    </p>
                  </div>

                  {/* Hashtags */}
                  {generatedCaption.generated_hashtags && (
                    <div>
                      <p className="text-sm text-text-secondary mb-2">Hashtags</p>
                      <div className="p-3 bg-blue-500/10 rounded-xl">
                        <p className="text-blue-400 text-sm">
                          {generatedCaption.generated_hashtags}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Media Analysis */}
                  {generatedCaption.media_analysis && (
                    <div>
                      <p className="text-sm text-text-secondary mb-2">Media Analysis</p>
                      <div className="p-3 bg-purple-500/10 rounded-xl">
                        <p className="text-purple-300 text-sm">
                          {generatedCaption.media_analysis}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/5">
                    <div className="text-center">
                      <p className="text-lg font-bold text-text-primary">
                        {generatedCaption.tokens_used}
                      </p>
                      <p className="text-xs text-text-muted">Tokens</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-text-primary">
                        {(generatedCaption.processing_time || 0).toFixed(1)}s
                      </p>
                      <p className="text-xs text-text-muted">Time</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-text-primary">
                        {formatProvider(generatedCaption.provider) || 'Claude'}
                      </p>
                      <p className="text-xs text-text-muted">{formatModel(generatedCaption.model_used) || 'Model'}</p>
                    </div>
                  </div>

                  {/* Use in Post */}
                  <div className="pt-4 border-t border-white/5">
                    <Button
                      className="w-full"
                      onClick={() => {
                        const fullCaption = [
                          generatedCaption.generated_caption,
                          generatedCaption.generated_hashtags,
                        ].filter(Boolean).join('\n\n');
                        navigate('/posts/create', { state: { caption: fullCaption } });
                      }}
                      leftIcon={<PaperAirplaneIcon className="w-5 h-5" />}
                    >
                      Use in Post
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-dark-600 flex items-center justify-center mb-4">
                    <SparklesIcon className="w-8 h-8 text-text-muted" />
                  </div>
                  <p className="text-text-secondary">
                    Your generated caption will appear here
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : history.length === 0 ? (
            <Card padding="lg" className="text-center">
              <ClockIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">No History Yet</h3>
              <p className="text-text-secondary">Generated captions will appear here</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history.map((item) => (
                <Card key={item.id} className="hover:border-white/20 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    {getStatusBadge(item.status)}
                    <span className="text-xs text-text-muted">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-text-primary line-clamp-3 mb-4">
                    {item.generated_caption || item.input_text || 'No caption'}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span className="capitalize">{item.tone}</span>
                      <span className="capitalize">{item.platform}</span>
                      <span>{item.tokens_used} tokens</span>
                      <span>{item.model_used ? formatModel(item.model_used) : 'Claude'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowPreview(item)}
                        className="p-2 rounded-lg hover:bg-dark-600 transition-colors"
                      >
                        <EyeIcon className="w-4 h-4 text-text-muted" />
                      </button>
                      <button
                        onClick={() => copyToClipboard(item.generated_caption || '')}
                        className="p-2 rounded-lg hover:bg-dark-600 transition-colors"
                      >
                        <ClipboardDocumentIcon className="w-4 h-4 text-text-muted" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Saved Tab */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : savedCaptions.length === 0 ? (
            <Card padding="lg" className="text-center">
              <BookmarkIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">No Saved Captions</h3>
              <p className="text-text-secondary">Save your favorite captions for quick access</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedCaptions.map((item) => (
                <Card key={item.id} className="hover:border-white/20 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <button onClick={() => toggleFavorite(item.id, item.is_favorite)}>
                      {item.is_favorite ? (
                        <HeartSolidIcon className="w-5 h-5 text-danger" />
                      ) : (
                        <HeartIcon className="w-5 h-5 text-text-muted hover:text-danger" />
                      )}
                    </button>
                    <span className="text-xs text-text-muted">
                      Used {item.used_count} times
                    </span>
                  </div>
                  <p className="text-text-primary line-clamp-4 mb-3">
                    {item.caption_text}
                  </p>
                  {item.hashtags && (
                    <p className="text-blue-400 text-sm mb-4 line-clamp-2">
                      {item.hashtags}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <span className="text-xs text-text-muted">
                      {format(new Date(item.created_at), 'MMM d, yyyy')}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyToClipboard(item.caption_text)}
                        className="p-2 rounded-lg hover:bg-dark-600 transition-colors"
                      >
                        <ClipboardDocumentIcon className="w-4 h-4 text-text-muted" />
                      </button>
                      <button
                        onClick={() => deleteSaved(item.id)}
                        className="p-2 rounded-lg hover:bg-danger/20 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4 text-danger" />
                      </button>
                    </div>
                  </div>
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
            <h3 className="text-lg font-semibold text-text-primary">Caption Templates</h3>
            <Button leftIcon={<PlusIcon className="w-5 h-5" />} size="sm">
              Create Template
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : templates.length === 0 ? (
            <Card padding="lg" className="text-center">
              <DocumentTextIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">No Templates Yet</h3>
              <p className="text-text-secondary mb-4">Create reusable caption templates</p>
              <Button leftIcon={<PlusIcon className="w-5 h-5" />}>
                Create Your First Template
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="hover:border-white/20 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-xs font-medium capitalize">
                      {template.category.replace('_', ' ')}
                    </span>
                    {template.is_global && (
                      <StarSolidIcon className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <h4 className="font-semibold text-text-primary mb-2">{template.name}</h4>
                  <p className="text-text-secondary text-sm line-clamp-3 mb-4">
                    {template.template_text}
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted capitalize">{template.tone}</span>
                      <span className="text-xs text-text-muted capitalize">{template.platform}</span>
                    </div>
                    <Button size="sm" variant="secondary">
                      Use
                    </Button>
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

          {/* Usage Stats */}
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Usage Statistics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-dark-700/50 rounded-xl text-center">
                <p className="text-2xl font-bold text-text-primary">{totalTokensUsed.toLocaleString()}</p>
                <p className="text-sm text-text-muted">Total Tokens</p>
              </div>
              <div className="p-4 bg-dark-700/50 rounded-xl text-center">
                <p className="text-2xl font-bold text-text-primary">{totalGenerations}</p>
                <p className="text-sm text-text-muted">Generations</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Preview Modal */}
      <Modal
        isOpen={!!showPreview}
        onClose={() => setShowPreview(null)}
        title="Caption Details"
        size="lg"
      >
        {showPreview && (
          <div className="space-y-4">
            {showPreview.input_text && (
              <div>
                <p className="text-sm text-text-secondary mb-2">Input Topic</p>
                <div className="p-3 bg-dark-700/50 rounded-xl">
                  <p className="text-text-primary">{showPreview.input_text}</p>
                </div>
              </div>
            )}

            {showPreview.generated_caption && (
              <div>
                <p className="text-sm text-text-secondary mb-2">Generated Caption</p>
                <div className="p-4 bg-dark-700/50 rounded-xl">
                  <p className="text-text-primary whitespace-pre-wrap">
                    {showPreview.generated_caption}
                  </p>
                </div>
              </div>
            )}

            {showPreview.generated_hashtags && (
              <div>
                <p className="text-sm text-text-secondary mb-2">Hashtags</p>
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <p className="text-blue-400">{showPreview.generated_hashtags}</p>
                </div>
              </div>
            )}

            {showPreview.media_analysis && (
              <div>
                <p className="text-sm text-text-secondary mb-2">Media Analysis</p>
                <div className="p-3 bg-purple-500/10 rounded-xl">
                  <p className="text-purple-300">{showPreview.media_analysis}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/5">
              <div className="p-3 bg-dark-700/50 rounded-xl text-center">
                <p className="text-sm font-medium text-text-primary capitalize">{showPreview.tone}</p>
                <p className="text-xs text-text-muted">Tone</p>
              </div>
              <div className="p-3 bg-dark-700/50 rounded-xl text-center">
                <p className="text-sm font-medium text-text-primary capitalize">{showPreview.length}</p>
                <p className="text-xs text-text-muted">Length</p>
              </div>
              <div className="p-3 bg-dark-700/50 rounded-xl text-center">
                <p className="text-sm font-medium text-text-primary capitalize">{showPreview.platform}</p>
                <p className="text-xs text-text-muted">Platform</p>
              </div>
              <div className="p-3 bg-dark-700/50 rounded-xl text-center">
                <p className="text-sm font-medium text-text-primary">{showPreview.tokens_used}</p>
                <p className="text-xs text-text-muted">Tokens</p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                fullWidth
                onClick={() => copyToClipboard(showPreview.generated_caption || '')}
                leftIcon={<ClipboardDocumentIcon className="w-5 h-5" />}
              >
                Copy Caption
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowPreview(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default AICaptionPage;
