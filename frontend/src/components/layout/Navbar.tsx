import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bars3Icon,
  ChatBubbleLeftEllipsisIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store';
import { DiamondBadge } from '../diamond';
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
    <nav
      className={`fixed ${isImpersonating ? 'top-[40px]' : 'top-0'} left-0 right-0 z-50 h-[56px]`}
      style={{
        background: 'rgb(var(--c-bg-secondary))',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <div className="flex items-center justify-between h-full px-4 lg:px-5">
        {/* Left: hamburger (mobile) + logo */}
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={onMenuClick}
            className="lg:hidden btn-icon"
            aria-label="Toggle menu"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>

          {/* Logo + Brand */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div
              className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, #E8364F, #FF6B6B)',
                boxShadow: '0 2px 8px rgba(232,54,79,0.3)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" fill="white" strokeLinejoin="round" />
              </svg>
            </div>
            <span
              className="text-[18px] font-extrabold tracking-tight hidden sm:block"
              style={{
                background: 'linear-gradient(135deg, #E8364F, #FF6B6B)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Sellanto
            </span>
          </Link>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Diamond Balance */}
          <DiamondBadge />

          {/* Notifications */}
          <NotificationCenter />

          {/* Messages */}
          <button
            onClick={onChatToggle}
            className={`btn-icon relative transition-colors ${isChatOpen ? 'text-coral bg-coral/10' : ''}`}
          >
            <ChatBubbleLeftEllipsisIcon className="w-5 h-5" />
          </button>

          {/* Profile */}
          <div className="relative ml-1">
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-white/5 transition-colors"
            >
              <div
                className="w-8 h-8 rounded-[10px] flex items-center justify-center text-white font-semibold text-xs"
                style={{
                  background: 'linear-gradient(135deg, rgb(var(--c-blue)), rgb(var(--c-purple)))',
                }}
              >
                {user ? getInitials(`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username) : 'U'}
              </div>
              <span className="hidden lg:block text-sm font-medium text-text-secondary">
                {user ? (`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username) : 'User'}
              </span>
            </button>

            {showProfile && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 mt-2 w-48 rounded-xl p-2"
                style={{
                  background: 'rgb(var(--c-bg-elevated))',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                }}
              >
                <Link
                  to="/profile"
                  className="block px-4 py-2 rounded-lg hover:bg-white/5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Profile
                </Link>
                <Link
                  to="/settings"
                  className="block px-4 py-2 rounded-lg hover:bg-white/5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Settings
                </Link>
                <hr className="my-2 border-white/[0.06]" />
                <button
                  onClick={() => useAuthStore.getState().logout()}
                  className="w-full text-left px-4 py-2 rounded-lg hover:bg-white/5 text-sm text-coral"
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
