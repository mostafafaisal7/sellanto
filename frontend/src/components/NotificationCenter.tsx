import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import notificationService from '../services/notificationService';

interface Notification {
  id: number;
  event_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data_json: Record<string, unknown>;
}

const EVENT_ICONS: Record<string, string> = {
  post_approved: '✅',
  post_rejected: '❌',
  changes_requested: '📝',
  post_published: '🚀',
  publish_failed: '⚠️',
  new_comment: '💬',
  weekly_report: '📊',
  winner_detected: '🏆',
  captions_ready: '✍️',
  images_ready: '🎨',
};

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) loadNotifications();
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const data = await notificationService.getUnreadCount();
      setUnreadCount(data.unread_count);
    } catch {
      // Silent fail
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationService.getNotifications({ limit: 20 });
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
    setLoading(false);
  };

  const handleMarkRead = async (id: number) => {
    try {
      await notificationService.markRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch {
      // Silent fail
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Silent fail
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await notificationService.deleteNotification(id);
      const n = notifications.find(x => x.id === id);
      setNotifications(notifications.filter(x => x.id !== id));
      if (n && !n.is_read) setUnreadCount(Math.max(0, unreadCount - 1));
    } catch {
      // Silent fail
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-icon relative"
      >
        <BellIcon className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 top-12 w-[380px] max-h-[500px] bg-dark-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs text-primary-400 hover:text-primary-300">
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-[400px]">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-text-secondary text-sm">
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 p-3 border-b border-white/5 hover:bg-white/5 transition-colors ${
                      !n.is_read ? 'bg-primary-500/5' : ''
                    }`}
                  >
                    <span className="text-lg mt-0.5">{EVENT_ICONS[n.event_type] || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.is_read ? 'font-medium' : ''}`}>{n.title}</p>
                      {n.message && <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.message}</p>}
                      <p className="text-xs text-text-secondary mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    <div className="flex gap-1">
                      {!n.is_read && (
                        <button onClick={() => handleMarkRead(n.id)} className="p-1 hover:bg-white/10 rounded" title="Mark read">
                          <CheckIcon className="w-3.5 h-3.5 text-text-secondary" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(n.id)} className="p-1 hover:bg-white/10 rounded" title="Delete">
                        <TrashIcon className="w-3.5 h-3.5 text-text-secondary" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NotificationCenter;
