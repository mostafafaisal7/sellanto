import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GlobeAltIcon,
  ShieldCheckIcon,
  LinkIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../store';

interface ChecklistItem {
  id: string;
  emoji: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  done: boolean;
  href: string;
}

export function GettingStartedPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [items, setItems] = useState<ChecklistItem[]>([
    { id: 'brand', emoji: '🌐', icon: GlobeAltIcon, label: 'Set up Brand DNA', description: 'Let AI analyze your website and build your brand profile', done: false, href: '/setup/brand-dna' },
    { id: 'pillars', emoji: '🎯', icon: ShieldCheckIcon, label: 'Define Content Pillars', description: 'Choose the themes and topics your content will focus on', done: false, href: '/strategy?tab=pillars' },
    { id: 'competitors', emoji: '🛡️', icon: ShieldCheckIcon, label: 'Add Competitors', description: 'Track what your competitors are posting', done: false, href: '/strategy?tab=competitors' },
    { id: 'trends', emoji: '📈', icon: ShieldCheckIcon, label: 'Discover Trending Topics', description: 'Find what\'s trending in your industry right now', done: false, href: '/setup/trending' },
    { id: 'accounts', emoji: '🔗', icon: LinkIcon, label: 'Connect Social Accounts', description: 'Link your social media profiles for publishing', done: false, href: '/platforms' },
    { id: 'post', emoji: '✍️', icon: PencilSquareIcon, label: 'Create Your First Post', description: 'Generate and publish your first AI-powered post', done: false, href: '/posts/create' },
  ]);

  // Check onboarding status from user profile
  useEffect(() => {
    if (user?.onboarding_status) {
      const status = user.onboarding_status;
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === 'brand' && (status as unknown as Record<string, unknown>).brand_dna_generated) return { ...item, done: true };
          if (item.id === 'accounts' && (status as unknown as Record<string, unknown>).social_connected) return { ...item, done: true };
          return item;
        })
      );
    }
  }, [user]);

  const doneCount = items.filter((i) => i.done).length;
  const progress = (doneCount / items.length) * 100;
  const nextItem = items.find((i) => !i.done);

  return (
    <div className="max-w-[700px] mx-auto">
      {/* Welcome header */}
      <div className="mb-8 animate-in">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[32px] bounce-in" style={{ animationDelay: '0.3s' }}>👋</span>
          <h1 className="text-[26px] font-bold text-text-primary">Welcome to Sellanto!</h1>
        </div>
        <p className="text-[15px] text-text-secondary">
          Let's get everything set up. Complete these steps to start creating amazing content.
        </p>
      </div>

      {/* Progress */}
      <div
        className="rounded-[14px] p-[18px] mb-6 animate-in-delay-1"
        style={{
          background: 'rgb(var(--c-bg-card))',
          border: '1px solid var(--border-color)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[14px] font-semibold text-text-primary">{doneCount}/{items.length} tasks completed</span>
          <span className="text-[13px] font-semibold text-text-secondary">{Math.round(progress)}%</span>
        </div>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-2.5">
        {items.map((item, i) => {
          const isNext = item === nextItem;
          return (
            <div
              key={item.id}
              className={`rounded-[14px] px-[18px] py-[14px] flex items-center gap-3.5 transition-all duration-300 animate-in-delay-${Math.min(i + 2, 5)}`}
              style={{
                background: 'rgb(var(--c-bg-card))',
                border: `1px solid ${isNext ? 'rgba(232,54,79,0.3)' : 'var(--border-color)'}`,
                cursor: 'pointer',
              }}
              onClick={() => navigate(item.href)}
            >
              {/* Icon */}
              <div
                className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center flex-shrink-0 text-[20px]"
                style={{
                  background: item.done
                    ? 'rgba(16,185,129,0.1)'
                    : isNext
                      ? 'rgba(232,54,79,0.1)'
                      : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${item.done ? 'rgba(16,185,129,0.2)' : isNext ? 'rgba(232,54,79,0.2)' : 'var(--border-color)'}`,
                }}
              >
                {item.emoji}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-[14px] font-semibold text-text-primary">{item.label}</h3>
                <p className="text-[12.5px] text-text-secondary mt-0.5">{item.description}</p>
              </div>

              {/* Status */}
              {item.done ? (
                <div className="flex items-center gap-1.5">
                  <CheckCircleIcon className="w-5 h-5" style={{ color: 'rgb(var(--c-green))' }} />
                  <span className="text-[13px] font-semibold" style={{ color: 'rgb(var(--c-green))' }}>Done</span>
                </div>
              ) : isNext ? (
                <button
                  className="px-4 py-2 rounded-[10px] text-[13px] font-bold text-white flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                    boxShadow: 'var(--shadow-glow-coral)',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(item.href);
                  }}
                >
                  Let's go →
                </button>
              ) : (
                <ChevronRightIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mt-8">
        {[
          { label: 'Brand Profile', value: doneCount >= 1 ? 'Ready' : 'Pending', color: doneCount >= 1 ? 'green' : 'muted' },
          { label: 'Social Accounts', value: '0 connected', color: 'muted' },
          { label: 'Posts Created', value: '0 posts', color: 'muted' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[14px] p-4 text-center"
            style={{
              background: 'rgb(var(--c-bg-card))',
              border: '1px solid var(--border-color)',
            }}
          >
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">{stat.label}</p>
            <p
              className="text-[14px] font-bold"
              style={{
                color: stat.color === 'green'
                  ? 'rgb(var(--c-green))'
                  : 'rgb(var(--c-text-secondary))',
              }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GettingStartedPage;
