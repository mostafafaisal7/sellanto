import { useState, useCallback, useRef, useEffect } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, XMarkIcon, CloudArrowUpIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useMagicModeStore, type Product } from '../../store/magicModeStore';

interface ProductUploadScreenProps {
  onNext: () => void;
  onBack: () => void;
}

const BACKGROUND_SUGGESTIONS = [
  { value: 'clean', label: 'Clean / Minimal', desc: 'Simple, distraction-free background' },
  { value: 'lifestyle', label: 'Lifestyle', desc: 'Natural, real-world setting' },
  { value: 'studio', label: 'Studio', desc: 'Professional, controlled lighting' },
  { value: 'abstract', label: 'Abstract', desc: 'Creative, artistic background' },
];

export function ProductUploadScreen({ onNext, onBack }: ProductUploadScreenProps) {
  const store = useMagicModeStore();
  const [customBackgroundPrompt, setCustomBackgroundPrompt] = useState(
    store.productAnswers.customBackground || ''
  );

  // Initialize with one product if none exist
  useEffect(() => {
    if (store.products.length === 0) {
      store.addProduct();
    }
  }, []);

  const handleNext = useCallback(() => {
    // Validation: at least one product with at least one image and title
    const hasValidProduct = store.products.some(
      (p) => p.images.length > 0 && p.title.trim() !== ''
    );

    if (!hasValidProduct) {
      alert('Please add at least one product with an image and title to continue.');
      return;
    }

    // Save custom background prompt
    store.setProductAnswer('customBackground', customBackgroundPrompt);

    onNext();
  }, [store, customBackgroundPrompt, onNext]);

  const handleAddProduct = () => {
    if (store.products.length >= 5) {
      alert('Maximum 5 products allowed.');
      return;
    }
    store.addProduct();
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (!customBackgroundPrompt.trim()) {
      setCustomBackgroundPrompt(suggestion);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col p-10 pb-5"
      style={{ background: 'rgb(var(--c-bg-primary))' }}
    >
      {/* Header */}
      <div className="w-full max-w-[800px] mx-auto mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-[48px]">📦</div>
          <div>
            <h1 className="text-[28px] font-extrabold text-text-primary tracking-tight">
              Upload Your Products
            </h1>
            <p className="text-[15px] text-text-secondary">
              Upload 2-5 product images per product. We'll create stunning posts featuring them.
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
      <div className="flex-1 flex flex-col max-w-[800px] mx-auto w-full">
        {/* Product Cards */}
        <div className="space-y-6 mb-8">
          {store.products.map((product, productIndex) => (
            <ProductCard
              key={product.id}
              product={product}
              productIndex={productIndex}
              isFirst={productIndex === 0}
              onRemove={() => store.removeProduct(product.id)}
            />
          ))}

          {/* Add More Products Button */}
          {store.products.length < 5 && (
            <button
              onClick={handleAddProduct}
              className="w-full py-3.5 rounded-[14px] text-[15px] font-semibold transition-all flex items-center justify-center gap-2"
              style={{
                border: '2px dashed var(--border-color)',
                background: 'rgba(255,255,255,0.02)',
                color: 'rgb(var(--c-text-secondary))',
              }}
            >
              <PlusIcon className="w-5 h-5" />
              Add More Products
            </button>
          )}
        </div>

        {/* AI Training Product Selection */}
        {store.products.length > 0 && store.products.some(p => p.title.trim() !== '') && (
          <div className="mb-8">
            <label className="block text-[15px] font-semibold text-text-primary mb-3">
              Select Products for AI Image Generation
            </label>
            <p className="text-[13px] text-text-muted mb-4">
              Choose which products will be used by AI to generate images
            </p>
            <div className="space-y-2">
              {store.products
                .filter(p => p.title.trim() !== '')
                .map((product) => (
                  <ProductSelectionCheckbox
                    key={product.id}
                    product={product}
                    isSelected={store.selectedProductIds.includes(product.id)}
                    onToggle={() => store.toggleProductSelection(product.id)}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Custom Q&A Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="block text-[15px] font-semibold text-text-primary">
                Custom Questions & Answers (Optional)
              </label>
              <p className="text-[13px] text-text-muted mt-1">
                Add custom information to help AI understand your products better
              </p>
            </div>
          </div>

          {store.customQAs.length > 0 && (
            <div className="space-y-3 mb-3">
              {store.customQAs.map((qa) => (
                <CustomQACard key={qa.id} qa={qa} />
              ))}
            </div>
          )}

          <button
            onClick={() => store.addCustomQA()}
            className="w-full py-3 rounded-[12px] text-[14px] font-semibold transition-all flex items-center justify-center gap-2"
            style={{
              border: '1px dashed var(--border-color)',
              background: 'rgba(255,255,255,0.02)',
              color: 'rgb(var(--c-text-secondary))',
            }}
          >
            <PlusIcon className="w-4 h-4" />
            Add Custom Query
          </button>
        </div>

        {/* Background Style Section */}
        <div className="mb-8">
          <label className="block text-[15px] font-semibold text-text-primary mb-2">
            Background Style Prompt
          </label>
          <p className="text-[13px] text-text-muted mb-3">
            Describe the background style you want, or choose from suggestions below
          </p>

          {/* Custom Background Input */}
          <input
            type="text"
            value={customBackgroundPrompt}
            onChange={(e) => setCustomBackgroundPrompt(e.target.value)}
            placeholder="e.g., Minimalist white background with soft shadows..."
            className="w-full text-[15px] mb-4"
            style={{
              padding: '14px 18px',
              borderRadius: 12,
              border: '2px solid var(--border-color)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgb(var(--c-text-primary))',
            }}
          />

          {/* Suggestion Pills */}
          {!customBackgroundPrompt.trim() && (
            <div>
              <p className="text-[13px] text-text-muted mb-2">Quick suggestions:</p>
              <div className="grid grid-cols-2 gap-2">
                {BACKGROUND_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.value}
                    onClick={() => handleSuggestionClick(suggestion.desc)}
                    className="text-left p-3 rounded-[10px] transition-all hover:border-coral"
                    style={{
                      border: '1px solid var(--border-color)',
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <p className="text-[13px] font-semibold text-text-primary mb-0.5">
                      {suggestion.label}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {suggestion.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Next Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleNext}
            disabled={!store.products.some(p => p.images.length > 0 && p.title.trim() !== '')}
            className="px-8 py-3.5 rounded-[14px] text-[15px] font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: store.products.some(p => p.images.length > 0 && p.title.trim() !== '')
                ? 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))'
                : 'rgba(255,255,255,0.1)',
              boxShadow: store.products.some(p => p.images.length > 0 && p.title.trim() !== '')
                ? 'var(--shadow-glow-coral)'
                : 'none',
            }}
          >
            Continue to Platforms <ArrowRightIcon className="w-4 h-4 inline-block ml-2" />
          </button>
        </div>
      </div>

      {/* Back button at bottom */}
      <div className="w-full max-w-[800px] mx-auto pt-4">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5">
          <ArrowLeftIcon className="w-4 h-4" /> Back
        </button>
      </div>
    </div>
  );
}

// Product Card Component
function ProductCard({
  product,
  productIndex,
  isFirst,
  onRemove
}: {
  product: Product;
  productIndex: number;
  isFirst: boolean;
  onRemove: () => void;
}) {
  const store = useMagicModeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Generate preview URLs when images change
  useEffect(() => {
    // Cleanup old URLs
    previewUrls.forEach(url => URL.revokeObjectURL(url));

    // Generate new URLs
    const urls = product.images.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);

    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [product.images]);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    const currentImageCount = product.images.length;
    const remainingSlots = 5 - currentImageCount;

    if (remainingSlots === 0) {
      alert('Maximum 5 images per product.');
      return;
    }

    const validFiles: File[] = [];

    for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
      const file = files[i];

      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image file.`);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} is too large. Max 10MB.`);
        continue;
      }

      validFiles.push(file);
    }

    validFiles.forEach(file => store.addProductImage(product.id, file));
  }, [product.id, product.images.length, store]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  return (
    <div
      className="p-6 rounded-[18px] transition-all"
      style={{
        border: '1px solid var(--border-color)',
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-[16px] font-bold text-text-primary">
          Product {productIndex + 1}
          {isFirst && <span className="text-[12px] font-normal text-coral ml-2">(Required)</span>}
        </h3>
        {!isFirst && (
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            <TrashIcon className="w-4 h-4 text-red-400" />
          </button>
        )}
      </div>

      {/* Image Upload */}
      <div className="mb-4">
        <label className="block text-[14px] font-semibold text-text-secondary mb-2">
          Product Images ({product.images.length}/5)
        </label>

        {product.images.length < 5 && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed rounded-[12px] p-6 transition-all cursor-pointer hover:border-coral mb-3"
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
            <div className="flex flex-col items-center gap-2 text-center">
              <CloudArrowUpIcon className="w-8 h-8 text-text-muted" />
              <p className="text-[13px] font-medium text-text-primary">
                Drop images or click to browse
              </p>
              <p className="text-[11px] text-text-muted">
                PNG, JPG up to 10MB • {5 - product.images.length} remaining
              </p>
            </div>
          </div>
        )}

        {/* Image Previews */}
        {previewUrls.length > 0 && (
          <div className="grid grid-cols-5 gap-2">
            {previewUrls.map((url, idx) => (
              <div
                key={idx}
                className="relative aspect-square rounded-lg overflow-hidden group"
                style={{
                  border: '1px solid var(--border-color)',
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <img
                  src={url}
                  alt={`Product ${productIndex + 1} - Image ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => store.removeProductImage(product.id, idx)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  <XMarkIcon className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">
            Product Title {isFirst && <span className="text-coral">*</span>}
          </label>
          <input
            type="text"
            value={product.title}
            onChange={(e) => store.updateProduct(product.id, { title: e.target.value })}
            placeholder="e.g., Handmade Leather Wallet"
            className="w-full text-[14px]"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid var(--border-color)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgb(var(--c-text-primary))',
            }}
          />
        </div>

        <div className="col-span-2">
          <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">
            Product Description (Optional)
          </label>
          <textarea
            value={product.description || ''}
            onChange={(e) => store.updateProduct(product.id, { description: e.target.value })}
            placeholder="Brief description of your product..."
            rows={2}
            className="w-full text-[14px]"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid var(--border-color)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgb(var(--c-text-primary))',
              resize: 'vertical',
            }}
          />
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">
            Quantity (Optional)
          </label>
          <input
            type="text"
            value={product.quantity || ''}
            onChange={(e) => store.updateProduct(product.id, { quantity: e.target.value })}
            placeholder="e.g., 50 units"
            className="w-full text-[14px]"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid var(--border-color)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgb(var(--c-text-primary))',
            }}
          />
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">
            Price (Optional)
          </label>
          <input
            type="text"
            value={product.price || ''}
            onChange={(e) => store.updateProduct(product.id, { price: e.target.value })}
            placeholder="e.g., $49.99"
            className="w-full text-[14px]"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid var(--border-color)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgb(var(--c-text-primary))',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Product Selection Checkbox Component
function ProductSelectionCheckbox({
  product,
  isSelected,
  onToggle
}: {
  product: Product;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 p-3 rounded-[10px] transition-all text-left"
      style={{
        border: `1px solid ${isSelected ? 'rgba(232,54,79,0.3)' : 'var(--border-color)'}`,
        background: isSelected ? 'rgba(232,54,79,0.06)' : 'rgba(255,255,255,0.02)',
      }}
    >
      <div
        className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded transition-all"
        style={{
          border: `2px solid ${isSelected ? 'rgb(var(--c-coral))' : 'rgba(255,255,255,0.15)'}`,
          background: isSelected ? 'rgb(var(--c-coral))' : 'transparent',
        }}
      >
        {isSelected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div className="flex-1">
        <p className="text-[14px] font-semibold text-text-primary">
          {product.title}
        </p>
        {product.description && (
          <p className="text-[12px] text-text-muted line-clamp-1">
            {product.description}
          </p>
        )}
      </div>
      <div className="text-[12px] text-text-muted">
        {product.images.length} image{product.images.length !== 1 ? 's' : ''}
      </div>
    </button>
  );
}

// Custom Q&A Card Component
function CustomQACard({ qa }: { qa: { id: string; question: string; answer: string } }) {
  const store = useMagicModeStore();

  return (
    <div
      className="p-4 rounded-[12px]"
      style={{
        border: '1px solid var(--border-color)',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[13px] font-semibold text-text-secondary">Custom Q&A</p>
        <button
          onClick={() => store.removeCustomQA(qa.id)}
          className="p-1 rounded hover:bg-red-500/10 transition-colors"
        >
          <TrashIcon className="w-3.5 h-3.5 text-red-400" />
        </button>
      </div>

      <div className="space-y-2">
        <input
          type="text"
          value={qa.question}
          onChange={(e) => store.updateCustomQA(qa.id, { question: e.target.value })}
          placeholder="Your question (e.g., What makes this product unique?)"
          className="w-full text-[13px]"
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgb(var(--c-text-primary))',
          }}
        />
        <textarea
          value={qa.answer}
          onChange={(e) => store.updateCustomQA(qa.id, { answer: e.target.value })}
          placeholder="Your answer..."
          rows={2}
          className="w-full text-[13px]"
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgb(var(--c-text-primary))',
            resize: 'vertical',
          }}
        />
      </div>
    </div>
  );
}

export default ProductUploadScreen;
