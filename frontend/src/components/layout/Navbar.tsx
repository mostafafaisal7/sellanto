import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bars3Icon,
  MagnifyingGlassIcon,
  ChatBubbleLeftEllipsisIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store';
import { NotificationCenter } from '../NotificationCenter';

interface NavbarProps {
  onMenuClick: () => void;
  onChatToggle?: () => void;
  isChatOpen?: boolean;
  isImpersonating?: boolean;
}

export function Navbar({ onMenuClick, onChatToggle, isChatOpen, isImpersonating }: NavbarProps) {
  const { user } = useAuthStore();
  const [showProfile, setShowProfile] = useState(false);

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  return (
    <nav className={`fixed ${isImpersonating ? 'top-[40px]' : 'top-0'} left-0 right-0 z-50 h-[70px] bg-dark-800/95 backdrop-blur-xl border-b border-white/5`}>
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left section */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden btn-icon"
            aria-label="Toggle menu"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>

          <Link to="/overflow" className="flex items-center gap-3">
            <motion.div
              className="icon-wrapper-sm"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </motion.div>
            <span className="text-xl font-bold font-heading hidden sm:block">
              <span className="gradient-text">Sellanto</span>
            </span>
          </Link>
        </div>

        {/* Center - Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              placeholder="Search..."
              className="input pl-10 py-2.5 bg-dark-700/50"
            />
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <NotificationCenter />

          {/* Messages / Support Chat */}
          <button
            onClick={onChatToggle}
            className={`btn-icon relative transition-colors ${isChatOpen ? 'text-primary bg-primary/10' : ''}`}
          >
            <ChatBubbleLeftEllipsisIcon className="w-5 h-5" />
          </button>

          {/* Profile */}
          <div className="relative ml-2">
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-white/5 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center text-white font-semibold text-sm">
                {user ? getInitials(user.username) : 'U'}
              </div>
              <span className="hidden lg:block text-sm font-medium">
                {user?.username || 'User'}
              </span>
            </button>

            {showProfile && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 mt-2 w-48 card p-2"
              >
                <Link
                  to="/profile"
                  className="block px-4 py-2 rounded-lg hover:bg-white/5 text-sm"
                >
                  Profile
                </Link>
                <Link
                  to="/settings"
                  className="block px-4 py-2 rounded-lg hover:bg-white/5 text-sm"
                >
                  Settings
                </Link>
                <hr className="my-2 border-white/5" />
                <button
                  onClick={() => useAuthStore.getState().logout()}
                  className="w-full text-left px-4 py-2 rounded-lg hover:bg-white/5 text-sm text-danger"
                >
                  Logout
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
