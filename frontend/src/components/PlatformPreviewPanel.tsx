import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HeartIcon,
  ChatBubbleLeftIcon,
  ArrowPathRoundedSquareIcon,
  ShareIcon,
  BookmarkIcon,
  HandThumbUpIcon,
  EllipsisHorizontalIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

interface Props {
  caption: string;
  mediaUrl?: string;
  platforms: string[];
  username?: string;
}

type PlatformKey = 'twitter' | 'linkedin' | 'instagram' | 'facebook';

const PLATFORM_CONFIG: Record<PlatformKey, { label: string; charLimit: number; color: string }> = {
  twitter: { label: 'Twitter / X', charLimit: 280, color: 'text-blue-400' },
  linkedin: { label: 'LinkedIn', charLimit: 3000, color: 'text-blue-500' },
  instagram: { label: 'Instagram', charLimit: 2200, color: 'text-pink-400' },
  facebook: { label: 'Facebook', charLimit: 63206, color: 'text-blue-600' },
};

const PLATFORM_ORDER: PlatformKey[] = ['twitter', 'linkedin', 'instagram', 'facebook'];

function truncate(text: string, limit: number): { truncated: string; isTruncated: boolean } {
  if (text.length <= limit) return { truncated: text, isTruncated: false };
  return { truncated: text.slice(0, limit), isTruncated: true };
}

function TwitterPreview({ caption, mediaUrl, username }: { caption: string; mediaUrl?: string; username: string }) {
  const { truncated, isTruncated } = truncate(caption, 280);
  const displayName = username || 'Your Brand';
  const handle = `@${displayName.toLowerCase().replace(/\s+/g, '')}`;

  return (
    <div className="bg-dark-700 rounded-xl p-4 max-w-md">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm flex-shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-bold text-sm text-text-primary">{displayName}</span>
            <span className="text-text-muted text-sm">{handle}</span>
            <span className="text-text-muted text-sm">· 1m</span>
          </div>
          {/* Tweet body */}
          <p className="text-sm text-text-primary mt-1 whitespace-pre-wrap">
            {truncated}
            {isTruncated && <span className="text-text-muted">...</span>}
          </p>
          {isTruncated && (
            <p className="text-xs text-red-400 mt-1">
              Exceeds 280 character limit ({caption.length}/280)
            </p>
          )}
          {/* Media */}
          {mediaUrl && (
            <div className="mt-3 rounded-xl overflow-hidden border border-white/10">
              <img src={mediaUrl} alt="Post media" className="w-full h-48 object-cover" />
            </div>
          )}
          {/* Actions */}
          <div className="flex items-center justify-between mt-3 text-text-muted">
            <button className="flex items-center gap-1 hover:text-blue-400 transition-colors">
              <ChatBubbleLeftIcon className="w-4 h-4" />
              <span className="text-xs">0</span>
            </button>
            <button className="flex items-center gap-1 hover:text-green-400 transition-colors">
              <ArrowPathRoundedSquareIcon className="w-4 h-4" />
              <span className="text-xs">0</span>
            </button>
            <button className="flex items-center gap-1 hover:text-red-400 transition-colors">
              <HeartIcon className="w-4 h-4" />
              <span className="text-xs">0</span>
            </button>
            <button className="flex items-center gap-1 hover:text-blue-400 transition-colors">
              <ShareIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkedInPreview({ caption, mediaUrl, username }: { caption: string; mediaUrl?: string; username: string }) {
  const VISIBLE_LIMIT = 210;
  const { truncated, isTruncated } = truncate(caption, VISIBLE_LIMIT);
  const [expanded, setExpanded] = useState(false);
  const displayName = username || 'Your Brand';

  return (
    <div className="bg-dark-700 rounded-xl max-w-md overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold flex-shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-sm text-text-primary">{displayName}</p>
            <p className="text-xs text-text-muted">Professional Title</p>
            <p className="text-xs text-text-muted flex items-center gap-1">
              1m · <GlobeAltIcon className="w-3 h-3" />
            </p>
          </div>
          <div className="ml-auto">
            <EllipsisHorizontalIcon className="w-5 h-5 text-text-muted" />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-2">
        <p className="text-sm text-text-primary whitespace-pre-wrap">
          {expanded || !isTruncated ? caption : truncated}
          {isTruncated && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="text-text-muted hover:text-text-secondary ml-1"
            >
              ...see more
            </button>
          )}
        </p>
      </div>

      {/* Media */}
      {mediaUrl && (
        <div className="border-t border-white/5">
          <img src={mediaUrl} alt="Post media" className="w-full h-56 object-cover" />
        </div>
      )}

      {/* Reactions bar */}
      <div className="px-4 py-2 flex items-center gap-1 border-t border-white/5">
        <span className="text-xs text-text-muted">0 reactions</span>
        <span className="text-xs text-text-muted ml-auto">0 comments</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-around px-4 py-2 border-t border-white/10 text-text-muted">
        <button className="flex items-center gap-1.5 hover:text-blue-400 transition-colors text-xs font-medium py-2">
          <HandThumbUpIcon className="w-4 h-4" /> Like
        </button>
        <button className="flex items-center gap-1.5 hover:text-blue-400 transition-colors text-xs font-medium py-2">
          <ChatBubbleLeftIcon className="w-4 h-4" /> Comment
        </button>
        <button className="flex items-center gap-1.5 hover:text-blue-400 transition-colors text-xs font-medium py-2">
          <ArrowPathRoundedSquareIcon className="w-4 h-4" /> Repost
        </button>
        <button className="flex items-center gap-1.5 hover:text-blue-400 transition-colors text-xs font-medium py-2">
          <ShareIcon className="w-4 h-4" /> Send
        </button>
      </div>
    </div>
  );
}

function InstagramPreview({ caption, mediaUrl, username }: { caption: string; mediaUrl?: string; username: string }) {
  const VISIBLE_LIMIT = 125;
  const { truncated, isTruncated } = truncate(caption, VISIBLE_LIMIT);
  const [expanded, setExpanded] = useState(false);
  const displayName = username || 'yourbrand';
  const handle = displayName.toLowerCase().replace(/\s+/g, '');

  return (
    <div className="bg-dark-700 rounded-xl max-w-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5">
          <div className="w-full h-full rounded-full bg-dark-700 flex items-center justify-center text-text-primary font-bold text-xs">
            {displayName.charAt(0).toUpperCase()}
          </div>
        </div>
        <span className="font-semibold text-sm text-text-primary">{handle}</span>
        <EllipsisHorizontalIcon className="w-5 h-5 text-text-muted ml-auto" />
      </div>

      {/* Image */}
      <div className="aspect-square bg-dark-800 flex items-center justify-center">
        {mediaUrl ? (
          <img src={mediaUrl} alt="Post media" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center text-text-muted">
            <div className="w-16 h-16 mx-auto mb-2 rounded-lg bg-dark-700 flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </div>
            <p className="text-xs">No image selected</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <HeartIcon className="w-6 h-6 text-text-primary cursor-pointer hover:text-red-400 transition-colors" />
            <ChatBubbleLeftIcon className="w-6 h-6 text-text-primary cursor-pointer hover:text-text-secondary transition-colors" />
            <ShareIcon className="w-6 h-6 text-text-primary cursor-pointer hover:text-text-secondary transition-colors" />
          </div>
          <BookmarkIcon className="w-6 h-6 text-text-primary cursor-pointer hover:text-text-secondary transition-colors" />
        </div>

        <p className="text-xs font-semibold text-text-primary mb-1">0 likes</p>

        {/* Caption */}
        <p className="text-sm text-text-primary">
          <span className="font-semibold mr-1">{handle}</span>
          {expanded || !isTruncated ? caption : truncated}
          {isTruncated && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="text-text-muted hover:text-text-secondary ml-1"
            >
              ...more
            </button>
          )}
        </p>
        <p className="text-xs text-text-muted mt-1">1 MINUTE AGO</p>
      </div>
    </div>
  );
}

function FacebookPreview({ caption, mediaUrl, username }: { caption: string; mediaUrl?: string; username: string }) {
  const displayName = username || 'Your Brand';

  return (
    <div className="bg-dark-700 rounded-xl max-w-md overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold flex-shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-sm text-text-primary">{displayName}</p>
            <p className="text-xs text-text-muted flex items-center gap-1">
              Just now · <GlobeAltIcon className="w-3 h-3" />
            </p>
          </div>
          <EllipsisHorizontalIcon className="w-5 h-5 text-text-muted ml-auto" />
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-3">
        <p className="text-sm text-text-primary whitespace-pre-wrap">{caption}</p>
      </div>

      {/* Media */}
      {mediaUrl && (
        <div>
          <img src={mediaUrl} alt="Post media" className="w-full h-56 object-cover" />
        </div>
      )}

      {/* Reactions */}
      <div className="px-4 py-2 flex items-center justify-between border-t border-white/5">
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1">
            <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[8px] text-white">
              <HandThumbUpIcon className="w-2.5 h-2.5" />
            </span>
            <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-[8px] text-white">
              <HeartSolidIcon className="w-2.5 h-2.5" />
            </span>
          </div>
          <span className="text-xs text-text-muted ml-1">0</span>
        </div>
        <span className="text-xs text-text-muted">0 comments · 0 shares</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-around px-4 py-2 border-t border-white/10 text-text-muted">
        <button className="flex items-center gap-1.5 hover:text-blue-400 transition-colors text-sm font-medium py-1.5 flex-1 justify-center">
          <HandThumbUpIcon className="w-5 h-5" /> Like
        </button>
        <button className="flex items-center gap-1.5 hover:text-blue-400 transition-colors text-sm font-medium py-1.5 flex-1 justify-center">
          <ChatBubbleLeftIcon className="w-5 h-5" /> Comment
        </button>
        <button className="flex items-center gap-1.5 hover:text-blue-400 transition-colors text-sm font-medium py-1.5 flex-1 justify-center">
          <ShareIcon className="w-5 h-5" /> Share
        </button>
      </div>
    </div>
  );
}

export function PlatformPreviewPanel({ caption, mediaUrl, platforms, username }: Props) {
  const availablePlatforms = PLATFORM_ORDER.filter((p) => platforms.includes(p));
  const [activeTab, setActiveTab] = useState<PlatformKey>(
    (availablePlatforms[0] as PlatformKey) || 'twitter'
  );

  const displayName = username || 'Your Brand';

  if (availablePlatforms.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-text-secondary">No platforms selected for preview</p>
      </div>
    );
  }

  const renderPreview = () => {
    switch (activeTab) {
      case 'twitter':
        return <TwitterPreview caption={caption} mediaUrl={mediaUrl} username={displayName} />;
      case 'linkedin':
        return <LinkedInPreview caption={caption} mediaUrl={mediaUrl} username={displayName} />;
      case 'instagram':
        return <InstagramPreview caption={caption} mediaUrl={mediaUrl} username={displayName} />;
      case 'facebook':
        return <FacebookPreview caption={caption} mediaUrl={mediaUrl} username={displayName} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Platform tabs */}
      <div className="flex items-center gap-1 bg-dark-700 rounded-lg p-1">
        {availablePlatforms.map((platform) => {
          const config = PLATFORM_CONFIG[platform];
          return (
            <button
              key={platform}
              onClick={() => setActiveTab(platform)}
              className={`relative flex-1 text-xs font-medium py-2 px-3 rounded-md transition-colors ${
                activeTab === platform
                  ? 'bg-dark-800 text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {activeTab === platform && (
                <motion.div
                  layoutId="platform-tab-indicator"
                  className="absolute inset-0 bg-dark-800 rounded-md"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <span className="relative z-10">{config.label}</span>
            </button>
          );
        })}
      </div>

      {/* Character count info */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-text-muted">
          {caption.length} / {PLATFORM_CONFIG[activeTab].charLimit.toLocaleString()} characters
        </span>
        {caption.length > PLATFORM_CONFIG[activeTab].charLimit && (
          <span className="text-xs text-red-400 font-medium">Over limit</span>
        )}
      </div>

      {/* Preview */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.15 }}
          className="flex justify-center"
        >
          {renderPreview()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default PlatformPreviewPanel;
