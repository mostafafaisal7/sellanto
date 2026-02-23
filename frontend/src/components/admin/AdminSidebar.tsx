import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HomeIcon,
  UsersIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onImpersonateClick: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
}

const mainNavItems: NavItem[] = [
  { name: 'Dashboard', href: '/admin-panel', icon: HomeIcon },
  { name: 'Users', href: '/admin-panel/users', icon: UsersIcon },
  { name: 'Analytics', href: '/admin-panel/analytics', icon: ChartBarIcon },
];

const toolNavItems: NavItem[] = [
  { name: 'Django Admin', href: '/admin/', icon: Cog6ToothIcon, external: true },
];

export function AdminSidebar({ isOpen, onClose, onImpersonateClick }: AdminSidebarProps) {
  const NavSection = ({ items, title }: { items: NavItem[]; title?: string }) => (
    <div className="mb-6">
      {title && (
        <h3 className="px-4 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </h3>
      )}
      <nav className="space-y-1">
        {items.map((item) =>
          item.external ? (
            <a
              key={item.name}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl mx-2 transition-colors"
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1">{item.name}</span>
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a>
          ) : (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/admin-panel'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl mx-2 transition-colors ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1">{item.name}</span>
            </NavLink>
          )
        )}
      </nav>
    </div>
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Mobile close button */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-white/5">
        <span className="text-lg font-bold text-amber-400">Admin Menu</span>
        <button onClick={onClose} className="btn-icon">
          <XMarkIcon className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6 px-1">
        <NavSection items={mainNavItems} />
        <NavSection items={toolNavItems} title="Tools" />

        {/* Quick Actions */}
        <div className="mb-6">
          <h3 className="px-4 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Quick Actions
          </h3>
          <nav className="space-y-1">
            <button
              onClick={() => {
                onClose();
                onImpersonateClick();
              }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-amber-400 hover:bg-amber-400/5 rounded-xl mx-2 transition-colors w-full text-left"
            >
              <UserGroupIcon className="w-5 h-5" />
              <span>Impersonate User</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Info card */}
      <div className="p-4">
        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-500/20">
          <h4 className="font-semibold text-sm text-amber-400">Admin Panel</h4>
          <p className="text-xs text-slate-400 mt-1">Manage users, monitor usage, and configure API settings.</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col fixed left-0 top-[70px] bottom-0 w-[260px] border-r border-white/5 z-30" style={{ background: 'rgb(15, 23, 42)' }}>
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="lg:hidden fixed left-0 top-0 bottom-0 w-[260px] z-50"
            style={{ background: 'rgb(15, 23, 42)' }}
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

export default AdminSidebar;
