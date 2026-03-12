import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircleIcon, XMarkIcon, ChatBubbleLeftRightIcon, PhotoIcon } from '@heroicons/react/24/outline';
import type { FacebookOAuthPage } from '../../services/facebookOAuthService';

interface MessengerPagePickerProps {
  pages: FacebookOAuthPage[];
  onSelect: (page: FacebookOAuthPage) => Promise<void>;
  onSkip: () => void;
}

export function MessengerPagePicker({ pages, onSelect, onSkip }: MessengerPagePickerProps) {
  const [selected, setSelected] = useState<FacebookOAuthPage | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!selected || loading) return;
    setLoading(true);
    await onSelect(selected);
    setLoading(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md rounded-2xl border border-white/10 p-6"
          style={{ background: 'rgb(15, 23, 42)' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Choose Messenger Page</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {pages.length} page{pages.length > 1 ? 's' : ''} connected for posting
                </p>
              </div>
            </div>
            <button
              onClick={onSkip}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-slate-400 mb-4">
            Which page should handle <span className="text-white font-medium">Messenger Bot</span> conversations and auto-replies?
          </p>

          {/* Page list */}
          <div className="space-y-2 max-h-64 overflow-y-auto mb-5">
            {pages.map((page) => (
              <button
                key={page.page_id}
                onClick={() => setSelected(page)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                  selected?.page_id === page.page_id
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{page.name}</p>
                    {page.has_instagram && (
                      <div className="flex items-center gap-1 mt-1">
                        <PhotoIcon className="w-3 h-3 text-pink-400" />
                        <span className="text-xs text-pink-400">{page.instagram_name}</span>
                      </div>
                    )}
                    {page.instagram_warning && (
                      <p className="text-xs text-amber-400 mt-1">⚠ {page.instagram_warning}</p>
                    )}
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    selected?.page_id === page.page_id
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-slate-600'
                  }`}>
                    {selected?.page_id === page.page_id && (
                      <CheckCircleIcon className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={!selected || loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 text-white"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Setting up...
                </span>
              ) : (
                'Use This Page for Messenger'
              )}
            </button>
            <button
              onClick={onSkip}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white border border-white/5 hover:border-white/10 transition-all"
            >
              Skip
            </button>
          </div>

          <p className="text-xs text-slate-500 text-center mt-3">
            You can change this later in Messenger settings
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default MessengerPagePicker;
