import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bars3Icon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store';

interface AdminNavbarProps {
  onMenuClick: () => void;
}

export function AdminNavbar({ onMenuClick }: AdminNavbarProps) {
  const { user, logout } = useAuthStore();

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[70px] border-b border-white/5" style={{ background: 'linear-gradient(135deg, rgb(15, 23, 42), rgb(30, 41, 59))' }}>
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button onClick={onMenuClick} className="lg:hidden btn-icon" aria-label="Toggle menu">
            <Bars3Icon className="w-6 h-6 text-white" />
          </button>
          <Link to="/admin-panel" className="flex items-center gap-3">
            <motion.div
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
            >
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </motion.div>
            <div className="hidden sm:block">
              <span className="text-xl font-bold text-white">Sellanto</span>
              <span className="text-xs font-medium text-amber-400 ml-2 px-2 py-0.5 bg-amber-400/10 rounded-full">Admin</span>
            </div>
          </Link>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* Django Admin Link */}
          <a
            href="/admin/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            Django Admin
            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
          </a>

          {/* Back to App */}
          <Link
            to="/"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            Back to App
          </Link>

          {/* Profile */}
          <div className="flex items-center gap-2 pl-3 border-l border-white/10">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-semibold text-sm">
              {user ? getInitials(user.username) : 'A'}
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-medium text-white">{user?.username}</p>
              <p className="text-[10px] text-slate-400">Administrator</p>
            </div>
            <button
              onClick={() => logout()}
              className="ml-2 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default AdminNavbar;
