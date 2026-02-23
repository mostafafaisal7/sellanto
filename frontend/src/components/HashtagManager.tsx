import { useState, useEffect } from 'react';
import {
  HashtagIcon, PlusIcon,
  BookmarkIcon,
} from '@heroicons/react/24/outline';
import hashtagService from '../services/hashtagService';

interface Hashtag {
  id: number;
  tag: string;
  tier: string;
  platform: string;
  estimated_volume: number;
  is_selected: boolean;
  placement: string;
}

interface Props {
  postId: number;
  brandId?: number;
  platform: string;
}

const TIER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  high_volume: { bg: 'bg-green-500/10', text: 'text-green-400', label: 'High Volume' },
  mid_volume: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: 'Mid Volume' },
  niche: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Niche' },
};

const PLACEMENT_OPTIONS = [
  { value: 'inline', label: 'Inline' },
  { value: 'end_of_caption', label: 'End of Caption' },
  { value: 'first_comment', label: 'First Comment (IG)' },
];

export function HashtagManager({ postId, brandId, platform }: Props) {
  const [hashtags, setHashtags] = useState<Hashtag[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showGroupSave, setShowGroupSave] = useState(false);
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    loadHashtags();
  }, [postId]);

  const loadHashtags = async () => {
    setLoading(true);
    try {
      const data = await hashtagService.getHashtags(postId);
      setHashtags(data);
    } catch (err) {
      console.error('Failed to load hashtags:', err);
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await hashtagService.generateHashtags(postId, { platform });
      setHashtags(data);
    } catch (err) {
      console.error('Failed to generate hashtags:', err);
    }
    setGenerating(false);
  };

  const handleToggle = async (hashtagId: number, isSelected: boolean) => {
    try {
      const updated = await hashtagService.toggleHashtag(hashtagId, { is_selected: !isSelected });
      setHashtags(hashtags.map(h => h.id === hashtagId ? updated : h));
    } catch (err) {
      console.error('Failed to toggle hashtag:', err);
    }
  };

  const handlePlacementChange = async (hashtagId: number, placement: string) => {
    try {
      const updated = await hashtagService.toggleHashtag(hashtagId, { placement });
      setHashtags(hashtags.map(h => h.id === hashtagId ? updated : h));
    } catch {
      // Silent
    }
  };

  const handleSaveGroup = async () => {
    if (!brandId || !groupName) return;
    const selectedTags = hashtags.filter(h => h.is_selected).map(h => h.tag);
    try {
      await hashtagService.createGroup({ brand: brandId, name: groupName, tags: selectedTags });
      setShowGroupSave(false);
      setGroupName('');
    } catch (err) {
      console.error('Failed to save group:', err);
    }
  };

  const selectedCount = hashtags.filter(h => h.is_selected).length;
  const groupedByTier = {
    high_volume: hashtags.filter(h => h.tier === 'high_volume'),
    mid_volume: hashtags.filter(h => h.tier === 'mid_volume'),
    niche: hashtags.filter(h => h.tier === 'niche'),
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <HashtagIcon className="w-5 h-5 text-primary-400" />
          Hashtags
          <span className="text-xs text-text-secondary">({selectedCount} selected)</span>
        </h3>
        <div className="flex gap-2">
          {hashtags.length > 0 && (
            <button onClick={() => setShowGroupSave(true)} className="btn-secondary text-xs px-2 py-1 flex items-center gap-1">
              <BookmarkIcon className="w-3 h-3" /> Save Group
            </button>
          )}
          <button onClick={handleGenerate} disabled={generating} className="btn-primary text-xs px-3 py-1 flex items-center gap-1">
            {generating ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
            ) : (
              <PlusIcon className="w-3 h-3" />
            )}
            Generate
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto" />
        </div>
      ) : hashtags.length === 0 ? (
        <div className="text-center py-6 text-text-secondary text-sm">
          Click "Generate" to create hashtags for this post
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tier Groups */}
          {Object.entries(groupedByTier).map(([tier, tags]) => {
            if (tags.length === 0) return null;
            const tierInfo = TIER_COLORS[tier] || TIER_COLORS.mid_volume;
            return (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tierInfo.bg} ${tierInfo.text}`}>
                    {tierInfo.label}
                  </span>
                  <span className="text-xs text-text-secondary">{tags.filter(t => t.is_selected).length}/{tags.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleToggle(tag.id, tag.is_selected)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                        tag.is_selected
                          ? `${tierInfo.bg} ${tierInfo.text} border-current`
                          : 'bg-dark-700 text-text-secondary border-white/10 opacity-50'
                      }`}
                    >
                      #{tag.tag}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Placement Selector */}
          <div>
            <label className="block text-xs font-medium mb-1">Placement</label>
            <div className="flex gap-2">
              {PLACEMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    hashtags.filter(h => h.is_selected).forEach(h => handlePlacementChange(h.id, opt.value));
                  }}
                  className="btn-secondary text-xs px-3 py-1"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-dark-700/50 rounded-lg p-3">
            <p className="text-xs text-text-secondary mb-1">Preview:</p>
            <p className="text-sm text-primary-400">
              {hashtags.filter(h => h.is_selected).map(h => `#${h.tag}`).join(' ')}
            </p>
          </div>
        </div>
      )}

      {/* Save Group Modal */}
      {showGroupSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowGroupSave(false)}>
          <div className="card p-4 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold mb-3">Save Hashtag Group</h4>
            <input type="text" className="input w-full mb-3" placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setShowGroupSave(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSaveGroup} disabled={!groupName} className="btn-primary flex-1">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HashtagManager;
