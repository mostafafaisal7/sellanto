import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhotoIcon,
  SparklesIcon,
  Cog6ToothIcon,
  ClockIcon,
  BookmarkIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  EyeIcon,
  AdjustmentsHorizontalIcon,
  SunIcon,
  CameraIcon,
  SwatchIcon,
  ArrowsPointingOutIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  StarIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon, StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { formatDistanceToNow } from 'date-fns';
import { Button, Card, Input, Textarea, Modal, Spinner } from '../components/ui';
import { DiamondCostIndicator } from '../components/diamond';
import type {
  ImageGeneration,
  BrandAsset,
  SavedImage,
  UserLogo,
  PromptTemplate,
  ImageStyle,
  ImageSize,
  ImageQuality,
  LogoPosition,
  ProductPosition,
  LightingStyle,
  CameraAngle,
  GenerationStatus,
} from '../types';
import { authFetch } from '../services/api';
import { PromptInfoButton } from '../components/ui/PromptInfoButton';
import { PromptPreviewPanel } from '../components/ai-image/PromptPreviewPanel';
import { ImageDiagnosisModal } from '../components/ai-image/ImageDiagnosisModal';
import { RepromptPanel } from '../components/ai-image/RepromptPanel';
import { imageService } from '../services/imageService';
import onboardingService from '../services/onboardingService';
import type { Brand } from '../types';
import type { PromptEngineerDiagnoseResponse } from '../types/promptEngineering';
import { toast } from '../store/toastStore';

// Style options
const styles: { id: ImageStyle; label: string }[] = [
  { id: 'realistic', label: 'Realistic' },
  { id: 'photographic', label: 'Photographic' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'artistic', label: 'Artistic' },
  { id: 'digital_art', label: 'Digital Art' },
  { id: 'anime', label: 'Anime' },
  { id: 'cartoon', label: 'Cartoon' },
  { id: '3d_render', label: '3D Render' },
  { id: 'watercolor', label: 'Watercolor' },
  { id: 'oil_painting', label: 'Oil Painting' },
  { id: 'pixel_art', label: 'Pixel Art' },
  { id: 'sketch', label: 'Sketch' },
  { id: 'comic_book', label: 'Comic Book' },
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'minimalist', label: 'Minimalist' },
  { id: 'abstract', label: 'Abstract' },
  { id: 'vintage', label: 'Vintage' },
];

// Size options
const sizes: { id: ImageSize; label: string; aspect: string }[] = [
  { id: '1024x1024', label: '1024x1024', aspect: 'Square' },
  { id: '1792x1024', label: '1792x1024', aspect: 'Landscape' },
  { id: '1024x1792', label: '1024x1792', aspect: 'Portrait' },
  { id: '1080x1080', label: '1080x1080', aspect: 'Instagram' },
  { id: '1080x1920', label: '1080x1920', aspect: 'Story' },
  { id: '1920x1080', label: '1920x1080', aspect: 'HD' },
  { id: '1200x628', label: '1200x628', aspect: 'Facebook' },
  { id: '800x800', label: '800x800', aspect: 'Thumbnail' },
  { id: '512x512', label: '512x512', aspect: 'Small' },
  { id: '256x256', label: '256x256', aspect: 'Icon' },
];

// Quality options
const qualities: { id: ImageQuality; label: string; description: string }[] = [
  { id: 'standard', label: 'Standard', description: 'Fast generation' },
  { id: 'high', label: 'High', description: 'Better details' },
  { id: 'hd', label: 'HD', description: 'Best quality' },
  { id: 'ultra', label: 'Ultra', description: 'Maximum quality' },
];

// Logo position options
const logoPositions: { id: LogoPosition; label: string }[] = [
  { id: 'none', label: 'No Logo' },
  { id: 'top_left', label: 'Top Left' },
  { id: 'top_right', label: 'Top Right' },
  { id: 'top_center', label: 'Top Center' },
  { id: 'bottom_left', label: 'Bottom Left' },
  { id: 'bottom_right', label: 'Bottom Right' },
  { id: 'bottom_center', label: 'Bottom Center' },
  { id: 'center', label: 'Center' },
];

// Lighting options
const lightingOptions: { id: LightingStyle; label: string }[] = [
  { id: 'natural', label: 'Natural' },
  { id: 'studio', label: 'Studio' },
  { id: 'dramatic', label: 'Dramatic' },
  { id: 'soft', label: 'Soft' },
  { id: 'golden_hour', label: 'Golden Hour' },
  { id: 'neon', label: 'Neon' },
  { id: 'backlit', label: 'Backlit' },
  { id: 'ambient', label: 'Ambient' },
];

// Camera angle options
const cameraAngles: { id: CameraAngle; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'top_down', label: 'Top Down' },
  { id: 'low_angle', label: 'Low Angle' },
  { id: 'high_angle', label: 'High Angle' },
  { id: 'dutch_angle', label: 'Dutch Angle' },
  { id: 'close_up', label: 'Close Up' },
  { id: 'wide_shot', label: 'Wide Shot' },
  { id: 'macro', label: 'Macro' },
];

type TabType = 'generate' | 'history' | 'saved' | 'logos' | 'templates' | 'settings';

export function AIImagePage() {
  const [activeTab, setActiveTab] = useState<TabType>('generate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<ImageGeneration | null>(null);
  const [history, setHistory] = useState<ImageGeneration[]>([]);
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);
  const [logos, setLogos] = useState<UserLogo[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreview, setShowPreview] = useState<ImageGeneration | null>(null);
  const [error, setError] = useState('');
  const [imageUsedPrompt, setImageUsedPrompt] = useState('');
  const [imageRegenerating, setImageRegenerating] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [provider, setProvider] = useState<'openai' | 'gemini'>('openai');
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>('realistic');
  const [selectedSize, setSelectedSize] = useState<ImageSize>('1024x1024');
  const [selectedQuality, setSelectedQuality] = useState<ImageQuality>('standard');
  const [selectedLogo, setSelectedLogo] = useState<number | null>(null);
  const [logoPosition, setLogoPosition] = useState<LogoPosition>('none');
  const [logoSize, setLogoSize] = useState(10);
  const [logoOpacity, setLogoOpacity] = useState(100);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [productPosition, setProductPosition] = useState<ProductPosition>('center');
  const [productScale, setProductScale] = useState(50);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [enhancePrompt, setEnhancePrompt] = useState(true);
  const [selectedLighting, setSelectedLighting] = useState<LightingStyle | undefined>(undefined);
  const [selectedCameraAngle, setSelectedCameraAngle] = useState<CameraAngle | undefined>(undefined);

  // Settings state
  const [totalImagesGenerated, setTotalImagesGenerated] = useState(0);
  const [openaiImagesGenerated, setOpenaiImagesGenerated] = useState(0);
  const [geminiImagesGenerated, setGeminiImagesGenerated] = useState(0);

  // Brand & prompt engineering state
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [diagnosisModalOpen, setDiagnosisModalOpen] = useState(false);
  const [currentDiagnosis, setCurrentDiagnosis] = useState<PromptEngineerDiagnoseResponse | null>(null);
  const [showRepromptPanel, setShowRepromptPanel] = useState(false);

  const canUsePromptEngineering = !!(
    selectedBrand?.brand_dna &&
    Object.keys(selectedBrand.brand_dna).length > 0 &&
    enhancePrompt
  );

  // Brand logo state (mandatory for generation)
  const [brandLogos, setBrandLogos] = useState<BrandAsset[]>([]);
  const [selectedBrandLogo, setSelectedBrandLogo] = useState<number | null>(null);
  const [brandLogoPosition, setBrandLogoPosition] = useState<'top_left' | 'top_right' | 'bottom_left' | 'bottom_right'>('bottom_right');

  // With Copy state
  const [withCopy, setWithCopy] = useState(false);
  const [copySuggestions, setCopySuggestions] = useState<{ text: string; style?: string }[]>([]);
  const [selectedCopyIdx, setSelectedCopyIdx] = useState<number | null>(null);
  const [customCopyText, setCustomCopyText] = useState('');
  const [useCustomCopy, setUseCustomCopy] = useState(false);
  const [loadingCopy, setLoadingCopy] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<{ generation_id: number; image_url: string }[]>([]);
  const [selectedVariation, setSelectedVariation] = useState(0);

  // Logo upload state
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [newLogoName, setNewLogoName] = useState('');
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);

  useEffect(() => {
    if (activeTab === 'generate') fetchLogos();
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'saved') fetchSavedImages();
    if (activeTab === 'logos') fetchLogos();
    if (activeTab === 'templates') fetchTemplates();
    if (activeTab === 'settings') fetchSettings();
  }, [activeTab]);

  useEffect(() => {
    const loadBrands = async () => {
      try {
        const brandList = await onboardingService.getBrands();
        setBrands(brandList);
        const primary = brandList.find((b: Brand) => b.is_primary) || brandList[0];
        if (primary) setSelectedBrand(primary);
      } catch (err) {
        console.error('Failed to fetch brands:', err);
      }
    };
    loadBrands();
  }, []);

  // Load brand logos when brand changes
  useEffect(() => {
    if (selectedBrand?.id) {
      const loadBrandLogos = async () => {
        try {
          const logos = await imageService.getBrandLogos(selectedBrand.id);
          setBrandLogos(logos);
          if (logos.length > 0) setSelectedBrandLogo(logos[0].id);
          else setSelectedBrandLogo(null);
        } catch { /* ignore */ }
      };
      loadBrandLogos();
    } else {
      setBrandLogos([]);
      setSelectedBrandLogo(null);
    }
  }, [selectedBrand?.id]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch('/api/v1/ai-image/history/', {
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

  const fetchSavedImages = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch('/api/v1/ai-image/saved/', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSavedImages(data.results || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch saved images:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogos = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch('/api/v1/ai-image/logos/', {
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
      const response = await authFetch('/api/v1/ai-image/templates/', {
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
      const response = await authFetch('/api/v1/ai-image/settings/', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTotalImagesGenerated(data.total_images_generated || 0);
        setOpenaiImagesGenerated(data.openai_images_generated || 0);
        setGeminiImagesGenerated(data.gemini_images_generated || 0);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const fetchCopySuggestions = async () => {
    setLoadingCopy(true);
    try {
      const res = await imageService.generateCopySuggestions({
        brand_id: selectedBrand?.id,
        caption_text: prompt || title || 'marketing image',
        count: 5,
      });
      const suggestions = res.suggestions || [];
      setCopySuggestions(suggestions);
      if (suggestions.length > 0) setSelectedCopyIdx(0);
    } catch {
      toast.error('Failed to generate copy suggestions');
    }
    setLoadingCopy(false);
  };

  const generateImage = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError('');
    setGeneratedImage(null);
    setGeneratedImages([]);
    try {
      const formData = new FormData();
      formData.append('title', title || 'Untitled');
      formData.append('prompt', prompt);
      if (negativePrompt) formData.append('negative_prompt', negativePrompt);
      formData.append('provider', provider);
      formData.append('style', selectedStyle);
      formData.append('size', selectedSize);
      formData.append('quality', selectedQuality);
      formData.append('enhance_prompt', String(enhancePrompt));

      // Brand logo (mandatory)
      if (selectedBrandLogo) {
        formData.append('brand_logo_id', String(selectedBrandLogo));
        formData.append('logo_position', brandLogoPosition);
        formData.append('logo_size', String(logoSize));
        formData.append('logo_opacity', String(logoOpacity));
      } else if (selectedLogo && logoPosition !== 'none') {
        // Legacy fallback
        formData.append('logo_id', String(selectedLogo));
        formData.append('logo_position', logoPosition);
        formData.append('logo_size', String(logoSize));
        formData.append('logo_opacity', String(logoOpacity));
      }

      if (productImage) {
        formData.append('product_image', productImage);
        formData.append('product_position', productPosition);
        formData.append('product_scale', String(productScale));
      }

      if (seed !== undefined) formData.append('seed', String(seed));
      if (selectedLighting) formData.append('add_lighting', selectedLighting);
      if (selectedCameraAngle) formData.append('camera_angle', selectedCameraAngle);
      if (selectedBrand?.id) formData.append('brand_id', String(selectedBrand.id));

      // With Copy
      if (withCopy) {
        formData.append('with_copy', 'true');
        const activeCopy = useCustomCopy
          ? customCopyText
          : (selectedCopyIdx !== null ? copySuggestions[selectedCopyIdx]?.text : '');
        if (activeCopy) formData.append('copy_text', activeCopy);
      }

      const response = await authFetch('/api/v1/ai-image/generate/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setGeneratedImage(data);
        const usedP = data.used_prompt || data.enhanced_prompt || data.revised_prompt || '';
        if (usedP) setImageUsedPrompt(usedP);

        // Handle dual images for with_copy
        if (data.images && data.images.length > 1) {
          setGeneratedImages(data.images);
          setSelectedVariation(0);
        }

        toast.success(withCopy ? '2 image variations generated!' : 'Image generated successfully!');
      } else {
        setError(data.error || 'Failed to generate image. Please check your API key in Settings.');
      }
    } catch (err) {
      console.error('Failed to generate image:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageRegenerate = async (editedPrompt: string) => {
    setImageRegenerating(true);
    try {
      const formData = new FormData();
      formData.append('title', title || 'Untitled');
      formData.append('prompt', editedPrompt);
      formData.append('provider', provider);
      formData.append('style', selectedStyle);
      formData.append('size', selectedSize);
      formData.append('quality', selectedQuality);
      formData.append('enhance_prompt', 'false');

      const response = await authFetch('/api/v1/ai-image/generate/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setGeneratedImage(data);
        const usedP = data.used_prompt || data.enhanced_prompt || data.revised_prompt || '';
        if (usedP) setImageUsedPrompt(usedP);
      }
    } catch { /* keep existing */ }
    setImageRegenerating(false);
  };

  const uploadLogo = async () => {
    if (!newLogoFile || !newLogoName.trim()) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('name', newLogoName);
      formData.append('logo_file', newLogoFile);

      const response = await authFetch('/api/v1/ai-image/logos/', {
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

  const deleteLogo = async (id: number) => {
    try {
      await authFetch(`/api/v1/ai-image/logos/${id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      fetchLogos();
    } catch (error) {
      console.error('Failed to delete logo:', error);
    }
  };


  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
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

  const tabs: { id: TabType; label: string; Icon: typeof PhotoIcon }[] = [
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
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
          <PhotoIcon className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">AI Image Generator</h1>
          <p className="text-text-secondary">Create stunning images with DALL-E & Gemini</p>
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
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
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
            {/* Brand Context */}
            {brands.length > 0 && (
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-text-primary text-sm">Brand Context</h3>
                    <p className="text-xs text-text-muted">Used for AI prompt engineering</p>
                  </div>
                  {brands.length > 1 ? (
                    <select
                      value={selectedBrand?.id || ''}
                      onChange={(e) => {
                        const brand = brands.find(b => b.id === Number(e.target.value));
                        setSelectedBrand(brand || null);
                      }}
                      className="px-3 py-2 bg-dark-700 border border-white/10 rounded-xl text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    >
                      {brands.map(b => (
                        <option key={b.id} value={b.id}>{b.brand_name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400 text-xs font-medium">
                      {selectedBrand?.brand_name}
                    </span>
                  )}
                </div>
              </Card>
            )}

            {/* Title & Prompt */}
            <Card>
              <div className="space-y-4">
                <Input
                  label="Title"
                  placeholder="Give your image a name..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Prompt <span className="text-danger">*</span>
                  </label>
                  <Textarea
                    placeholder="Describe the image you want to create in detail..."
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
                    placeholder="E.g., blurry, low quality, distorted faces..."
                    rows={2}
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                  />
                </div>
              </div>
            </Card>

            {/* Provider & Style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Provider */}
              <Card>
                <h3 className="font-semibold text-text-primary mb-3">AI Provider</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(['openai', 'gemini'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setProvider(p)}
                      className={`p-4 rounded-xl border-2 text-center transition-all ${
                        provider === p
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <p className="font-medium text-text-primary capitalize">{p}</p>
                      <p className="text-xs text-text-muted mt-1">
                        {p === 'openai' ? 'DALL-E 3' : 'Imagen'}
                      </p>
                    </button>
                  ))}
                </div>
              </Card>

              {/* Quality */}
              <Card>
                <h3 className="font-semibold text-text-primary mb-3">Quality</h3>
                <div className="grid grid-cols-2 gap-2">
                  {qualities.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => setSelectedQuality(q.id)}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        selectedQuality === q.id
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <p className="font-medium text-text-primary text-sm">{q.label}</p>
                      <p className="text-xs text-text-muted">{q.description}</p>
                    </button>
                  ))}
                </div>
              </Card>
            </div>

            {/* Style Selection */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <SwatchIcon className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-text-primary">Style</h3>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {styles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      selectedStyle === style.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <p className="text-xs font-medium text-text-primary">{style.label}</p>
                  </button>
                ))}
              </div>
            </Card>

            {/* Size Selection */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <ArrowsPointingOutIcon className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-text-primary">Size</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {sizes.map((size) => (
                  <button
                    key={size.id}
                    onClick={() => setSelectedSize(size.id)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      selectedSize === size.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <p className="text-xs font-medium text-text-primary">{size.label}</p>
                    <p className="text-xs text-text-muted">{size.aspect}</p>
                  </button>
                ))}
              </div>
            </Card>

            {/* Product Upload */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <CloudArrowUpIcon className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-text-primary">Product Image (Optional)</h3>
              </div>
              <p className="text-xs text-text-muted mb-4">
                Upload your product photo. AI will generate a matching background and place your product in it.
              </p>

              {productPreview ? (
                <div className="space-y-4">
                  <div className="relative inline-block w-full">
                    <img
                      src={productPreview}
                      alt="Product preview"
                      className="w-full max-h-48 object-contain rounded-xl border border-white/10"
                    />
                    <button
                      onClick={() => {
                        setProductImage(null);
                        setProductPreview(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-danger/80 rounded-lg hover:bg-danger transition-colors"
                    >
                      <TrashIcon className="w-4 h-4 text-white" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-text-secondary mb-2">Position</label>
                      <select
                        value={productPosition}
                        onChange={(e) => setProductPosition(e.target.value as ProductPosition)}
                        className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-xl text-text-primary"
                      >
                        <option value="center">Center</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-2">
                        Scale: {productScale}%
                      </label>
                      <input
                        type="range"
                        min="20"
                        max="90"
                        value={productScale}
                        onChange={(e) => setProductScale(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-green-500/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setProductImage(file);
                        setProductPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="hidden"
                  />
                  <PhotoIcon className="w-10 h-10 text-text-muted" />
                  <span className="text-sm text-text-secondary">Click to upload product image</span>
                </label>
              )}
            </Card>

            {/* Brand Logo Selection (Mandatory) */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <StarIcon className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-text-primary">Brand Logo <span className="text-red-400 text-xs">*required</span></h3>
              </div>
              {brandLogos.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-2">
                    {brandLogos.map((bl) => (
                      <button
                        key={bl.id}
                        onClick={() => setSelectedBrandLogo(bl.id)}
                        className={`p-2 rounded-xl border-2 transition-all ${
                          selectedBrandLogo === bl.id
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-white/10 hover:border-white/20'
                        }`}
                      >
                        <img src={bl.file} alt={bl.name} className="w-full h-12 object-contain" />
                        <p className="text-[10px] text-text-muted mt-1 truncate">{bl.name}</p>
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Logo Position</label>
                    <div className="grid grid-cols-4 gap-2">
                      {([
                        { id: 'top_left' as const, label: 'Top Left' },
                        { id: 'top_right' as const, label: 'Top Right' },
                        { id: 'bottom_left' as const, label: 'Bottom Left' },
                        { id: 'bottom_right' as const, label: 'Bottom Right' },
                      ]).map((pos) => (
                        <button
                          key={pos.id}
                          onClick={() => setBrandLogoPosition(pos.id)}
                          className={`p-2 rounded-xl border-2 text-center transition-all text-xs ${
                            brandLogoPosition === pos.id
                              ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                              : 'border-white/10 text-text-secondary hover:border-white/20'
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-text-secondary mb-2">Size: {logoSize}%</label>
                      <input type="range" min="5" max="30" value={logoSize} onChange={(e) => setLogoSize(Number(e.target.value))} className="w-full" />
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-2">Opacity: {logoOpacity}%</label>
                      <input type="range" min="10" max="100" value={logoOpacity} onChange={(e) => setLogoOpacity(Number(e.target.value))} className="w-full" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-yellow-400">No brand logos found. Upload a logo in Strategy Hub → Brand DNA first.</p>
                  <a href="/strategy?tab=dna" className="inline-block text-xs text-primary-400 hover:underline">
                    Go to Brand DNA →
                  </a>
                </div>
              )}
            </Card>

            {/* With Copy Toggle */}
            <Card>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DocumentTextIcon className="w-5 h-5 text-purple-400" />
                  <div>
                    <h3 className="font-semibold text-text-primary">With Copy</h3>
                    <p className="text-xs text-text-muted">Generate image with marketing text rendered by AI</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={withCopy}
                    onChange={(e) => setWithCopy(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                </label>
              </div>

              <AnimatePresence>
                {withCopy && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4 space-y-4 overflow-hidden"
                  >
                    {/* Tab toggle */}
                    <div className="flex gap-1 bg-dark-700 rounded-lg p-0.5">
                      <button
                        onClick={() => setUseCustomCopy(false)}
                        className={`flex-1 text-xs py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                          !useCustomCopy ? 'bg-purple-500/20 text-purple-400 font-medium' : 'text-text-muted hover:text-text-secondary'
                        }`}
                      >
                        <SparklesIcon className="w-3.5 h-3.5" /> AI Suggestions
                      </button>
                      <button
                        onClick={() => setUseCustomCopy(true)}
                        className={`flex-1 text-xs py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                          useCustomCopy ? 'bg-purple-500/20 text-purple-400 font-medium' : 'text-text-muted hover:text-text-secondary'
                        }`}
                      >
                        <PencilSquareIcon className="w-3.5 h-3.5" /> Custom Text
                      </button>
                    </div>

                    {/* AI Suggestions */}
                    {!useCustomCopy && (
                      <div className="space-y-2">
                        <button
                          onClick={fetchCopySuggestions}
                          disabled={loadingCopy}
                          className="w-full py-2.5 px-4 bg-purple-500/10 border border-purple-500/30 rounded-xl text-sm text-purple-400 hover:bg-purple-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {loadingCopy ? <Spinner /> : <SparklesIcon className="w-4 h-4" />}
                          {loadingCopy ? 'Generating...' : copySuggestions.length > 0 ? 'Regenerate Suggestions' : 'Generate Copy Suggestions'}
                        </button>
                        {copySuggestions.map((s, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedCopyIdx(idx)}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${
                              selectedCopyIdx === idx
                                ? 'border-purple-500/50 bg-purple-500/10'
                                : 'border-white/5 bg-dark-700 hover:border-white/15'
                            }`}
                          >
                            <p className="text-sm text-text-primary">{s.text}</p>
                            {s.style && <span className="text-[10px] text-text-muted uppercase mt-1 inline-block">{s.style}</span>}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Custom Text */}
                    {useCustomCopy && (
                      <Textarea
                        placeholder="Type your marketing copy text..."
                        rows={2}
                        value={customCopyText}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomCopyText(e.target.value)}
                      />
                    )}

                    <div className="flex items-center gap-2 bg-purple-500/5 border border-purple-500/10 rounded-lg p-2.5">
                      <SparklesIcon className="w-4 h-4 text-purple-400 shrink-0" />
                      <p className="text-[11px] text-purple-300">
                        With Copy generates <strong>2 image variations</strong> with your text rendered by AI (2x diamond cost)
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
                  {/* Logo Options */}
                  <Card>
                    <div className="flex items-center gap-3 mb-4">
                      <StarIcon className="w-5 h-5 text-amber-400" />
                      <h3 className="font-semibold text-text-primary">Logo Watermark</h3>
                    </div>

                    {logos.length > 0 ? (
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
                              <img
                                src={logo.logo_file}
                                alt={logo.name}
                                className="w-full h-12 object-contain"
                              />
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
                              <label className="block text-sm text-text-secondary mb-2">
                                Size: {logoSize}%
                              </label>
                              <input
                                type="range"
                                min="5"
                                max="30"
                                value={logoSize}
                                onChange={(e) => setLogoSize(Number(e.target.value))}
                                className="w-full"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-sm text-text-secondary mb-2">
                                Opacity: {logoOpacity}%
                              </label>
                              <input
                                type="range"
                                min="10"
                                max="100"
                                value={logoOpacity}
                                onChange={(e) => setLogoOpacity(Number(e.target.value))}
                                className="w-full"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-text-muted text-sm">
                        No logos uploaded. Go to Logos tab to upload your brand logos.
                      </p>
                    )}
                  </Card>

                  {/* Lighting & Camera */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Card>
                      <div className="flex items-center gap-3 mb-4">
                        <SunIcon className="w-5 h-5 text-yellow-400" />
                        <h3 className="font-semibold text-text-primary">Lighting</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {lightingOptions.map((light) => (
                          <button
                            key={light.id}
                            onClick={() => setSelectedLighting(
                              selectedLighting === light.id ? undefined : light.id
                            )}
                            className={`p-2 rounded-lg border transition-all text-sm ${
                              selectedLighting === light.id
                                ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                                : 'border-white/10 text-text-secondary hover:border-white/20'
                            }`}
                          >
                            {light.label}
                          </button>
                        ))}
                      </div>
                    </Card>

                    <Card>
                      <div className="flex items-center gap-3 mb-4">
                        <CameraIcon className="w-5 h-5 text-purple-400" />
                        <h3 className="font-semibold text-text-primary">Camera Angle</h3>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {cameraAngles.map((angle) => (
                          <button
                            key={angle.id}
                            onClick={() => setSelectedCameraAngle(
                              selectedCameraAngle === angle.id ? undefined : angle.id
                            )}
                            className={`p-2 rounded-lg border transition-all text-xs ${
                              selectedCameraAngle === angle.id
                                ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                                : 'border-white/10 text-text-secondary hover:border-white/20'
                            }`}
                          >
                            {angle.label}
                          </button>
                        ))}
                      </div>
                    </Card>
                  </div>

                  {/* Other Options */}
                  <Card>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-text-secondary mb-2">
                          Seed (for reproducibility)
                        </label>
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
                          className="w-5 h-5 rounded text-blue-500 bg-dark-600 border-white/20"
                        />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Prompt Preview */}
            {canUsePromptEngineering && prompt.trim() && !showPromptPreview && (
              <Button
                fullWidth
                size="md"
                variant="secondary"
                onClick={() => setShowPromptPreview(true)}
                leftIcon={<EyeIcon className="w-5 h-5" />}
              >
                Preview Engineered Prompt
              </Button>
            )}

            <AnimatePresence>
              {showPromptPreview && canUsePromptEngineering && prompt.trim() && (
                <PromptPreviewPanel
                  brandId={selectedBrand!.id}
                  subject={prompt}
                  platform="instagram"
                  mood={selectedStyle}
                  onUsePrompt={(p) => {
                    setPrompt(p);
                    setEnhancePrompt(false);
                    setShowPromptPreview(false);
                  }}
                  onGenerateWithPrompt={(p) => {
                    setShowPromptPreview(false);
                    handleImageRegenerate(p);
                  }}
                  onClose={() => setShowPromptPreview(false)}
                />
              )}
            </AnimatePresence>

            {/* Generate Button */}
            <Button
              fullWidth
              size="lg"
              onClick={generateImage}
              isLoading={isGenerating}
              disabled={!prompt.trim() || (brandLogos.length > 0 && !selectedBrandLogo)}
              leftIcon={<SparklesIcon className="w-5 h-5" />}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
            >
              {withCopy ? 'Generate 2 Variations' : 'Generate Image'} <DiamondCostIndicator cost={withCopy ? 30 : 15} className="ml-2" />
            </Button>
          </div>

          {/* Result Section */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text-primary flex items-center gap-2">
                  Generated Image
                  {imageUsedPrompt && <PromptInfoButton prompt={imageUsedPrompt} label="Image Generation Prompt" onRegenerate={handleImageRegenerate} regenerating={imageRegenerating} regenerateLabel="Regenerate Image" />}
                </h3>
                {generatedImage?.generated_image && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadImage(generatedImage.generated_image!, `${title || 'image'}.png`)}
                      className="p-2 rounded-lg hover:bg-dark-600 transition-colors"
                    >
                      <ArrowDownTrayIcon className="w-5 h-5 text-text-muted" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-dark-600 transition-colors">
                      <BookmarkIcon className="w-5 h-5 text-text-muted" />
                    </button>
                  </div>
                )}
              </div>

              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Spinner size="lg" />
                  <p className="mt-4 text-text-secondary">Generating your image...</p>
                  <p className="text-xs text-text-muted mt-2">This may take a few moments</p>
                </div>
              ) : generatedImages.length > 1 ? (
                /* Dual image display for with_copy */
                <div className="space-y-4">
                  <p className="text-sm text-text-secondary text-center">Choose your preferred variation:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {generatedImages.map((img, i) => (
                      <div
                        key={img.generation_id}
                        onClick={() => setSelectedVariation(i)}
                        className={`rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                          selectedVariation === i
                            ? 'border-blue-500 ring-2 ring-blue-500/30'
                            : 'border-white/10 hover:border-white/25'
                        }`}
                      >
                        <img src={img.image_url} alt={`Variation ${i + 1}`} className="w-full h-auto" />
                        <div className="p-2 bg-dark-700/80 text-center">
                          <p className="text-xs text-text-primary font-medium">Variation {i + 1}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {generatedImage?.copy_text_in_image && (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                      <p className="text-xs text-text-muted mb-1">Copy Text</p>
                      <p className="text-sm text-purple-300 font-medium">{generatedImage.copy_text_in_image}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/5">
                    <div className="text-center">
                      <p className="text-sm font-bold text-text-primary capitalize">{generatedImage?.style}</p>
                      <p className="text-xs text-text-muted">Style</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-text-primary">{generatedImage?.size}</p>
                      <p className="text-xs text-text-muted">Size</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-text-primary">
                        {(generatedImage?.processing_time || 0).toFixed(1)}s
                      </p>
                      <p className="text-xs text-text-muted">Time</p>
                    </div>
                  </div>
                </div>
              ) : generatedImage?.generated_image ? (
                <div className="space-y-4">
                  <div className="rounded-xl overflow-hidden bg-dark-700">
                    <img
                      src={generatedImage.generated_image_with_logo || generatedImage.generated_image}
                      alt={generatedImage.title}
                      className="w-full h-auto"
                    />
                  </div>

                  {generatedImage.enhanced_prompt && (
                    <div>
                      <p className="text-sm text-text-secondary mb-2">Enhanced Prompt</p>
                      <div className="p-3 bg-blue-500/10 rounded-xl">
                        <p className="text-blue-300 text-sm">{generatedImage.enhanced_prompt}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/5">
                    <div className="text-center">
                      <p className="text-sm font-bold text-text-primary capitalize">
                        {generatedImage.style}
                      </p>
                      <p className="text-xs text-text-muted">Style</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-text-primary">
                        {generatedImage.size}
                      </p>
                      <p className="text-xs text-text-muted">Size</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-text-primary">
                        {(generatedImage.processing_time || 0).toFixed(1)}s
                      </p>
                      <p className="text-xs text-text-muted">Time</p>
                    </div>
                  </div>

                  {/* Diagnose Issues */}
                  {generatedImage.status === 'completed' && selectedBrand && (
                    <div className="pt-3 border-t border-white/5 text-center">
                      <p className="text-xs text-text-muted mb-2">Not happy with the result?</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDiagnosisModalOpen(true)}
                      >
                        Diagnose Issues
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-dark-600 flex items-center justify-center mb-4">
                    <PhotoIcon className="w-8 h-8 text-text-muted" />
                  </div>
                  <p className="text-text-secondary">Your generated image will appear here</p>
                </div>
              )}
            </Card>

            {/* Re-prompt Panel */}
            {showRepromptPanel && generatedImage && selectedBrand && (
              <RepromptPanel
                generatedImage={generatedImage}
                brandId={selectedBrand.id}
                diagnosis={currentDiagnosis || undefined}
                onRegenerate={(correctedPrompt) => {
                  handleImageRegenerate(correctedPrompt);
                  setShowRepromptPanel(false);
                  setCurrentDiagnosis(null);
                }}
                onClose={() => {
                  setShowRepromptPanel(false);
                  setCurrentDiagnosis(null);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Diagnosis Modal */}
      {generatedImage && (
        <ImageDiagnosisModal
          isOpen={diagnosisModalOpen}
          onClose={() => setDiagnosisModalOpen(false)}
          generatedImage={generatedImage}
          onStartReprompt={(diagnosis) => {
            setCurrentDiagnosis(diagnosis);
            setShowRepromptPanel(true);
            setDiagnosisModalOpen(false);
          }}
        />
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
              <p className="text-text-secondary">Generated images will appear here</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {history.map((item) => (
                <Card key={item.id} padding="none" className="overflow-hidden group">
                  <div className="aspect-square bg-dark-700 relative">
                    {item.generated_image ? (
                      <img src={item.generated_image} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {getStatusBadge(item.status)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => setShowPreview(item)}
                        className="p-2 bg-white/20 rounded-lg hover:bg-white/30"
                      >
                        <EyeIcon className="w-5 h-5 text-white" />
                      </button>
                      {item.generated_image && (
                        <button
                          onClick={() => downloadImage(item.generated_image!, `${item.title}.png`)}
                          className="p-2 bg-white/20 rounded-lg hover:bg-white/30"
                        >
                          <ArrowDownTrayIcon className="w-5 h-5 text-white" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-text-primary truncate">{item.title}</p>
                    <p className="text-xs text-text-muted mt-1">
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
          ) : savedImages.length === 0 ? (
            <Card padding="lg" className="text-center">
              <BookmarkIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">No Saved Images</h3>
              <p className="text-text-secondary">Save your favorite images for quick access</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {savedImages.map((item) => (
                <Card key={item.id} padding="none" className="overflow-hidden group">
                  <div className="aspect-square bg-dark-700 relative">
                    <img src={item.image_file} alt={item.title} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2">
                      {item.is_favorite && <HeartSolidIcon className="w-5 h-5 text-danger" />}
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => downloadImage(item.image_file, `${item.title}.png`)}
                        className="p-2 bg-white/20 rounded-lg hover:bg-white/30"
                      >
                        <ArrowDownTrayIcon className="w-5 h-5 text-white" />
                      </button>
                      <button className="p-2 bg-white/20 rounded-lg hover:bg-white/30">
                        <TrashIcon className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-text-primary truncate">{item.title}</p>
                    <p className="text-xs text-text-muted mt-1">Downloaded {item.download_count} times</p>
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
          {/* Upload Logo */}
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Upload New Logo</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                placeholder="Logo name"
                value={newLogoName}
                onChange={(e) => setNewLogoName(e.target.value)}
              />
              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-blue-500/50 transition-colors">
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

          {/* Logos Grid */}
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : logos.length === 0 ? (
            <Card padding="lg" className="text-center">
              <StarIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">No Logos Yet</h3>
              <p className="text-text-secondary">Upload your brand logos to add watermarks to images</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {logos.map((logo) => (
                <Card key={logo.id} padding="sm" className="group relative">
                  <div className="aspect-square bg-dark-700 rounded-lg flex items-center justify-center p-4 mb-2">
                    <img src={logo.logo_file} alt={logo.name} className="max-w-full max-h-full object-contain" />
                  </div>
                  <p className="text-sm font-medium text-text-primary truncate">{logo.name}</p>
                  {logo.is_default && (
                    <span className="text-xs text-amber-400">Default</span>
                  )}
                  <button
                    onClick={() => deleteLogo(logo.id)}
                    className="absolute top-2 right-2 p-1.5 bg-danger/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <TrashIcon className="w-4 h-4 text-white" />
                  </button>
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
            <h3 className="text-lg font-semibold text-text-primary">Prompt Templates</h3>
            <Button leftIcon={<PlusIcon className="w-5 h-5" />} size="sm">
              Create Template
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : templates.length === 0 ? (
            <Card padding="lg" className="text-center">
              <DocumentTextIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">No Templates Yet</h3>
              <p className="text-text-secondary mb-4">Create reusable prompt templates</p>
              <Button leftIcon={<PlusIcon className="w-5 h-5" />}>Create Template</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="hover:border-white/20 transition-colors">
                  {template.preview_image && (
                    <div className="aspect-video rounded-lg overflow-hidden bg-dark-700 mb-4">
                      <img src={template.preview_image} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs capitalize">
                      {template.category}
                    </span>
                    {template.is_global && <StarSolidIcon className="w-4 h-4 text-amber-400" />}
                  </div>
                  <h4 className="font-semibold text-text-primary mb-2">{template.name}</h4>
                  <p className="text-text-secondary text-sm line-clamp-2 mb-4">{template.prompt_template}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted capitalize">{template.recommended_style}</span>
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

          {/* Usage Stats */}
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Usage Statistics</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-dark-700/50 rounded-xl text-center">
                <p className="text-2xl font-bold text-text-primary">{totalImagesGenerated}</p>
                <p className="text-sm text-text-muted">Total Images</p>
              </div>
              <div className="p-4 bg-dark-700/50 rounded-xl text-center">
                <p className="text-2xl font-bold text-text-primary">{openaiImagesGenerated}</p>
                <p className="text-sm text-text-muted">OpenAI</p>
              </div>
              <div className="p-4 bg-dark-700/50 rounded-xl text-center">
                <p className="text-2xl font-bold text-text-primary">{geminiImagesGenerated}</p>
                <p className="text-sm text-text-muted">Gemini</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Preview Modal */}
      <Modal isOpen={!!showPreview} onClose={() => setShowPreview(null)} title="Image Details" size="xl">
        {showPreview && (
          <div className="space-y-4">
            {showPreview.generated_image && (
              <div className="rounded-xl overflow-hidden bg-dark-700">
                <img src={showPreview.generated_image} alt={showPreview.title} className="w-full" />
              </div>
            )}
            <div>
              <h4 className="font-semibold text-text-primary mb-2">{showPreview.title}</h4>
              <p className="text-text-secondary text-sm">{showPreview.prompt}</p>
            </div>
            {showPreview.enhanced_prompt && (
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <p className="text-xs text-text-muted mb-1">Enhanced prompt:</p>
                <p className="text-blue-300 text-sm">{showPreview.enhanced_prompt}</p>
              </div>
            )}
            <div className="grid grid-cols-4 gap-3 pt-4 border-t border-white/5">
              <div className="p-3 bg-dark-700/50 rounded-xl text-center">
                <p className="text-sm font-medium text-text-primary capitalize">{showPreview.style}</p>
                <p className="text-xs text-text-muted">Style</p>
              </div>
              <div className="p-3 bg-dark-700/50 rounded-xl text-center">
                <p className="text-sm font-medium text-text-primary">{showPreview.size}</p>
                <p className="text-xs text-text-muted">Size</p>
              </div>
              <div className="p-3 bg-dark-700/50 rounded-xl text-center">
                <p className="text-sm font-medium text-text-primary capitalize">{showPreview.quality}</p>
                <p className="text-xs text-text-muted">Quality</p>
              </div>
              <div className="p-3 bg-dark-700/50 rounded-xl text-center">
                <p className="text-sm font-medium text-text-primary capitalize">{showPreview.provider}</p>
                <p className="text-xs text-text-muted">Provider</p>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              {showPreview.generated_image && (
                <Button
                  fullWidth
                  onClick={() => downloadImage(showPreview.generated_image!, `${showPreview.title}.png`)}
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

export default AIImagePage;
