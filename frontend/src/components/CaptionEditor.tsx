import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  SparklesIcon, DocumentDuplicateIcon,
  CheckIcon, BeakerIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';

interface Caption {
  id: number;
  platform: string;
  variant_number: number;
  body: string;
  cta_text: string;
  tone: string;
  char_count: number;
  char_status: string;
  is_within_limit: boolean;
  is_selected: boolean;
  is_ab_test: boolean;
  ab_label: string | null;
}

interface Props {
  postId: number;
  onCaptionChange?: () => void;
}

const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280,
  linkedin: 3000,
  facebook: 63206,
  instagram: 2200,
  all: 5000,
};

const STATUS_COLORS: Record<string, string> = {
  green: 'text-green-400',
  yellow: 'text-yellow-400',
  red: 'text-red-400',
};

export function CaptionEditor({ postId, onCaptionChange }: Props) {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  // Generate form
  const [tone, setTone] = useState('professional');
  const [platform, setPlatform] = useState('all');
  const [count, setCount] = useState(3);

  useEffect(() => {
    loadCaptions();
  }, [postId]);

  const loadCaptions = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/drafts/${postId}/captions/`);
      setCaptions(res.data);
    } catch (err) {
      console.error('Failed to load captions:', err);
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/drafts/${postId}/captions/generate/`, {
        tone,
        platforms: [platform],
        count,
      });
      setCaptions(res.data);
      onCaptionChange?.();
    } catch (err) {
      console.error('Failed to generate captions:', err);
    }
    setGenerating(false);
  };

  const handleSelect = async (captionId: number) => {
    try {
      await api.patch(`/captions/${captionId}/select/`);
      loadCaptions();
      onCaptionChange?.();
    } catch (err) {
      console.error('Failed to select caption:', err);
    }
  };

  const handleABTag = async (captionId: number, label: string) => {
    try {
      await api.patch(`/captions/${captionId}/ab-tag/`, { ab_label: label });
      loadCaptions();
    } catch (err) {
      console.error('Failed to tag A/B:', err);
    }
  };

  const handleEdit = async (captionId: number) => {
    try {
      await api.patch(`/post-captions/${captionId}/`, { body: editText });
      setEditingId(null);
      loadCaptions();
      onCaptionChange?.();
    } catch (err) {
      console.error('Failed to update caption:', err);
    }
  };

  const handleAdapt = async (captionId: number, targetPlatforms: string[]) => {
    try {
      await api.post(`/drafts/${postId}/captions/adapt/`, {
        caption_id: captionId,
        target_platforms: targetPlatforms,
      });
      loadCaptions();
    } catch (err) {
      console.error('Failed to adapt caption:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Generate Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Tone</label>
          <select className="input text-sm" value={tone} onChange={(e) => setTone(e.target.value)}>
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="friendly">Friendly</option>
            <option value="enthusiastic">Enthusiastic</option>
            <option value="humorous">Humorous</option>
            <option value="inspirational">Inspirational</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Platform</label>
          <select className="input text-sm" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="all">All Platforms</option>
            <option value="twitter">Twitter/X</option>
            <option value="linkedin">LinkedIn</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Variants</label>
          <select className="input text-sm" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            <option value={1}>1</option>
            <option value={3}>3</option>
            <option value={5}>5</option>
          </select>
        </div>
        <button onClick={handleGenerate} disabled={generating} className="btn-primary text-sm flex items-center gap-1.5">
          {generating ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <SparklesIcon className="w-4 h-4" />
          )}
          Generate
        </button>
      </div>

      {/* Caption List */}
      {loading ? (
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto" />
        </div>
      ) : captions.length === 0 ? (
        <div className="text-center py-8 text-text-secondary text-sm">
          Generate captions to get started
        </div>
      ) : (
        <div className="space-y-3">
          {captions.map((caption) => {
            const limit = PLATFORM_LIMITS[caption.platform] || 5000;
            const charRatio = caption.char_count / limit;
            const charColor = charRatio > 1 ? 'red' : charRatio > 0.85 ? 'yellow' : 'green';

            return (
              <motion.div key={caption.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`card p-4 ${caption.is_selected ? 'ring-2 ring-primary-500' : ''}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="badge text-xs capitalize">{caption.platform}</span>
                  <span className="text-xs text-text-secondary">Variant #{caption.variant_number}</span>
                  {caption.is_ab_test && (
                    <span className="badge badge-primary text-xs">A/B: {caption.ab_label}</span>
                  )}
                  <div className="flex-1" />
                  {/* Character counter */}
                  <span className={`text-xs font-mono ${STATUS_COLORS[charColor]}`}>
                    {caption.char_count}/{limit}
                  </span>
                </div>

                {editingId === caption.id ? (
                  <div>
                    <textarea
                      className="input w-full text-sm"
                      rows={4}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => setEditingId(null)} className="btn-secondary text-xs">Cancel</button>
                      <button onClick={() => handleEdit(caption.id)} className="btn-primary text-xs">Save</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap cursor-pointer hover:bg-dark-700/30 rounded p-1 -m-1"
                    onClick={() => { setEditingId(caption.id); setEditText(caption.body); }}
                  >
                    {caption.body}
                  </p>
                )}

                {/* Character limit bar */}
                <div className="mt-2 h-1 bg-dark-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${
                    charColor === 'green' ? 'bg-green-500' :
                    charColor === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} style={{ width: `${Math.min(charRatio * 100, 100)}%` }} />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={() => handleSelect(caption.id)} className={`text-xs flex items-center gap-1 px-2 py-1 rounded ${
                    caption.is_selected ? 'bg-green-500/10 text-green-400' : 'bg-dark-700 text-text-secondary hover:text-text-primary'
                  }`}>
                    <CheckIcon className="w-3 h-3" />
                    {caption.is_selected ? 'Selected' : 'Select'}
                  </button>
                  <button onClick={() => handleABTag(caption.id, caption.ab_label === 'A' ? 'B' : 'A')} className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-dark-700 text-text-secondary hover:text-text-primary">
                    <BeakerIcon className="w-3 h-3" />
                    A/B Tag
                  </button>
                  <button onClick={() => handleAdapt(caption.id, ['twitter', 'linkedin', 'instagram'].filter(p => p !== caption.platform))} className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-dark-700 text-text-secondary hover:text-text-primary">
                    <DocumentDuplicateIcon className="w-3 h-3" />
                    Adapt
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CaptionEditor;
