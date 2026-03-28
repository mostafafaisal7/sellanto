import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bars3Icon,
  MagnifyingGlassIcon,
  ChatBubbleLeftEllipsisIcon,
  BellIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store';
import { DiamondBadge } from '../diamond';

interface NavbarProps {
  onMenuClick: () => void;
  onChatToggle?: () => void;
  isChatOpen?: boolean;
  isImpersonating?: boolean;
}

export function Navbar({ onMenuClick, onChatToggle, isChatOpen, isImpersonating }: NavbarProps) {
  const { user } = useAuthStore();
  const [showProfile, setShowProfile] = useState(false);
  const [hasNotification] = useState(true);

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
        {/* Left: hamburger (mobile) + search */}
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={onMenuClick}
            className="lg:hidden btn-icon"
            aria-label="Toggle menu"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>

          {/* Search */}
          <div className="hidden md:flex flex-1 max-w-[420px]">
            <div className="relative w-full">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-[10px] transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border-color)',
                  color: 'rgb(var(--c-text-primary))',
                }}
              />
            </div>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Diamond Balance */}
          <DiamondBadge />

          {/* Notifications */}
          <button className="btn-icon relative">
            <BellIcon className="w-5 h-5" />
            {hasNotification && (
              <span
                className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full"
                style={{ background: 'rgb(var(--c-coral))' }}
              />
            )}
          </button>

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
                {user ? getInitials(user.username) : 'U'}
              </div>
              <span className="hidden lg:block text-sm font-medium text-text-secondary">
                {user?.username || 'User'}
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
