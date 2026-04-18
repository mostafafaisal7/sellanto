import { useState, useCallback, useRef } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, XMarkIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { useMagicModeStore } from '../../store/magicModeStore';

interface ProductUploadScreenProps {
  onNext: () => void;
  onBack: () => void;
}

const BACKGROUND_STYLES = [
  { value: 'clean', label: 'Clean / Minimal', desc: 'Simple, distraction-free background' },
  { value: 'lifestyle', label: 'Lifestyle', desc: 'Natural, real-world setting' },
  { value: 'studio', label: 'Studio', desc: 'Professional, controlled lighting' },
  { value: 'abstract', label: 'Abstract', desc: 'Creative, artistic background' },
];

export function ProductUploadScreen({ onNext, onBack }: ProductUploadScreenProps) {
  const store = useMagicModeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state for form fields
  const [productType, setProductType] = useState(store.productAnswers.type || '');
  const [productFeatures, setProductFeatures] = useState(store.productAnswers.features || '');
  const [selectedBackground, setSelectedBackground] = useState(store.productAnswers.background || 'clean');
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Generate preview URLs when component mounts if images already exist
  useState(() => {
    if (store.productImages.length > 0 && previewUrls.length === 0) {
      const urls = store.productImages.map(file => URL.createObjectURL(file));
      setPreviewUrls(urls);
    }
  });

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    const validFiles: File[] = [];
    const newPreviewUrls: string[] = [...previewUrls];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image file. Please upload images only.`);
        continue;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} is too large. Maximum file size is 10MB.`);
        continue;
      }

      validFiles.push(file);
      newPreviewUrls.push(URL.createObjectURL(file));
    }

    if (validFiles.length > 0) {
      // Add new images to store
      validFiles.forEach(file => store.addProductImage(file));
      setPreviewUrls(newPreviewUrls);
    }
  }, [store, previewUrls]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    // Revoke preview URL to free memory
    URL.revokeObjectURL(previewUrls[index]);

    // Remove from store and preview URLs
    store.removeProductImage(index);
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  }, [store, previewUrls]);

  const handleNext = useCallback(() => {
    // Validate - at least one product image required
    if (store.productImages.length === 0) {
      alert('Please upload at least one product image to continue.');
      return;
    }

    // Save product answers to store
    store.setProductAnswer('type', productType);
    store.setProductAnswer('features', productFeatures);
    store.setProductAnswer('background', selectedBackground);

    onNext();
  }, [store, productType, productFeatures, selectedBackground, onNext]);

  return (
    <div
      className="min-h-screen flex flex-col p-10 pb-5"
      style={{ background: 'rgb(var(--c-bg-primary))' }}
    >
      {/* Header */}
      <div className="w-full max-w-[680px] mx-auto mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-[48px]">📦</div>
          <div>
            <h1 className="text-[28px] font-extrabold text-text-primary tracking-tight">
              Upload Your Products
            </h1>
            <p className="text-[15px] text-text-secondary">
              Upload 2-5 product images. We'll create stunning posts featuring them.
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 text-[13px] text-text-muted">
          <span className="font-semibold" style={{ color: 'rgb(var(--c-coral))' }}>
            Product Upload
          </span>
          <ArrowRightIcon className="w-3 h-3" />
          <span>Platforms</span>
          <ArrowRightIcon className="w-3 h-3" />
          <span>Colors</span>
          <ArrowRightIcon className="w-3 h-3" />
          <span>Generate</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col max-w-[680px] mx-auto w-full">
        {/* Image Upload Area */}
        <div className="mb-8">
          <label className="block text-[15px] font-semibold text-text-primary mb-3">
            Product Images ({store.productImages.length}/5)
          </label>

          {/* Upload Dropzone */}
          {store.productImages.length < 5 && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="relative border-2 border-dashed rounded-[16px] p-8 transition-all cursor-pointer hover:border-coral"
              style={{
                borderColor: 'var(--border-color)',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />

              <div className="flex flex-col items-center gap-3 text-center">
                <CloudArrowUpIcon className="w-12 h-12 text-text-muted" />
                <div>
                  <p className="text-[15px] font-semibold text-text-primary mb-1">
                    Drop product images here or click to browse
                  </p>
                  <p className="text-[13px] text-text-secondary">
                    PNG, JPG up to 10MB each. Upload 2-5 images for best results.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Image Previews */}
          {previewUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {previewUrls.map((url, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-[12px] overflow-hidden group"
                  style={{
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <img
                    src={url}
                    alt={`Product ${index + 1}`}
                    className="w-full h-full object-cover"
                  />

                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      background: 'rgba(0,0,0,0.7)',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    <XMarkIcon className="w-4 h-4 text-white" />
                  </button>

                  {/* Image number badge */}
                  <div
                    className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-[11px] font-bold text-white"
                    style={{ background: 'rgba(0,0,0,0.6)' }}
                  >
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="space-y-6">
          {/* Product Type */}
          <div>
            <label className="block text-[15px] font-semibold text-text-primary mb-2">
              What type of products are these?
            </label>
            <input
              type="text"
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              placeholder="e.g., Handmade jewelry, Tech gadgets, Clothing, Food products..."
              className="w-full text-[15px]"
              style={{
                padding: '14px 18px',
                borderRadius: 12,
                border: '2px solid var(--border-color)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgb(var(--c-text-primary))',
              }}
            />
            <p className="text-[12px] text-text-muted mt-1.5">
              This helps us choose the right style and tone for your posts
            </p>
          </div>

          {/* Product Features (Optional) */}
          <div>
            <label className="block text-[15px] font-semibold text-text-primary mb-2">
              Any specific angles or features to highlight? (optional)
            </label>
            <textarea
              value={productFeatures}
              onChange={(e) => setProductFeatures(e.target.value)}
              placeholder="e.g., Focus on the texture, Show the packaging, Highlight the color options..."
              rows={3}
              className="w-full text-[15px]"
              style={{
                padding: '14px 18px',
                borderRadius: 12,
                border: '2px solid var(--border-color)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgb(var(--c-text-primary))',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Background Style */}
          <div>
            <label className="block text-[15px] font-semibold text-text-primary mb-3">
              Preferred background style
            </label>
            <div className="grid grid-cols-2 gap-3">
              {BACKGROUND_STYLES.map((style) => (
                <button
                  key={style.value}
                  onClick={() => setSelectedBackground(style.value)}
                  className="text-left p-4 rounded-[12px] transition-all"
                  style={{
                    border: `2px solid ${selectedBackground === style.value ? 'rgba(232,54,79,0.4)' : 'var(--border-color)'}`,
                    background: selectedBackground === style.value ? 'rgba(232,54,79,0.08)' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <div className="flex items-center gap-3 mb-1">
                    {/* Checkbox */}
                    <div
                      className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full transition-all"
                      style={{
                        border: `2px solid ${selectedBackground === style.value ? 'rgb(var(--c-coral))' : 'rgba(255,255,255,0.15)'}`,
                        background: selectedBackground === style.value ? 'rgb(var(--c-coral))' : 'transparent',
                      }}
                    >
                      {selectedBackground === style.value && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <span
                      className="text-[14px] font-bold"
                      style={{ color: selectedBackground === style.value ? 'rgb(var(--c-coral))' : 'rgb(var(--c-text-primary))' }}
                    >
                      {style.label}
                    </span>
                  </div>
                  <p className="text-[12px] text-text-secondary ml-8">
                    {style.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Next Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleNext}
            disabled={store.productImages.length === 0}
            className="px-8 py-3.5 rounded-[14px] text-[15px] font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: store.productImages.length > 0
                ? 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))'
                : 'rgba(255,255,255,0.1)',
              boxShadow: store.productImages.length > 0 ? 'var(--shadow-glow-coral)' : 'none',
            }}
          >
            Continue to Platforms <ArrowRightIcon className="w-4 h-4 inline-block ml-2" />
          </button>
        </div>
      </div>

      {/* Back button at bottom */}
      <div className="w-full max-w-[680px] mx-auto pt-4">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5">
          <ArrowLeftIcon className="w-4 h-4" /> Back
        </button>
      </div>
    </div>
  );
}

export default ProductUploadScreen;
