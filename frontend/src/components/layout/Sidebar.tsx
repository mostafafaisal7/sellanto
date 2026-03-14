import { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HomeIcon,
  PlusCircleIcon,
  DocumentTextIcon,
  LinkIcon,
  SparklesIcon,
  PhotoIcon,
  VideoCameraIcon,
  SpeakerWaveIcon,
  ChatBubbleBottomCenterTextIcon,
  UserIcon,
  Cog6ToothIcon,
  XMarkIcon,
  ChartBarIcon,
  BuildingOfficeIcon,
  MapIcon,
  LightBulbIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isImpersonating?: boolean;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children?: NavItem[];
}

const mainNavItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  {
    name: 'Strategy Hub', href: '/strategy', icon: MapIcon, badge: 'New',
    children: [
      { name: 'Brand DNA', href: '/strategy?tab=dna', icon: SparklesIcon },
      { name: 'Content Pillars', href: '/strategy?tab=pillars', icon: ChartBarIcon },
      { name: 'Competitors Analysis', href: '/strategy?tab=competitors', icon: MapIcon },
      { name: 'Trending Topics', href: '/strategy?tab=trending', icon: LightBulbIcon },
    ],
  },
  {
    name: 'Ideas Hub', href: '/ideas', icon: LightBulbIcon, badge: 'New',
    children: [
      { name: 'Idea History', href: '/ideas/history', icon: ClockIcon },
    ],
  },
  {
    name: 'Create Post', href: '/posts/create', icon: PlusCircleIcon,
    children: [
      { name: 'My Post History', href: '/posts', icon: DocumentTextIcon },
    ],
  },
  { name: 'Calendar', href: '/calendar', icon: CalendarDaysIcon, badge: 'New' },
  { name: 'Connect Account', href: '/platforms', icon: LinkIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
];

const aiNavItems: NavItem[] = [
  { name: 'AI Caption', href: '/ai-caption', icon: SparklesIcon, badge: 'New' },
  { name: 'AI Image', href: '/ai-image', icon: PhotoIcon },
  { name: 'AI Video', href: '/ai-video', icon: VideoCameraIcon },
  { name: 'AI Voice', href: '/ai-voice', icon: SpeakerWaveIcon },
  { name: 'Messenger Bot', href: '/messenger', icon: ChatBubbleBottomCenterTextIcon },
];

const settingsNavItems: NavItem[] = [
  { name: 'Profile', href: '/profile', icon: UserIcon },
  { name: 'Business Profile', href: '/business-profile', icon: BuildingOfficeIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

// Custom Gem icon component
function GemIconCustom({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 3h12l4 6-10 12L2 9l4-6z" />
      <path d="M2 9h20" />
      <path d="M12 21L8 9l4-6 4 6-4 12z" />
    </svg>
  );
}

function NavItemWithChildren({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const location = useLocation();
  const currentPath = location.pathname + location.search;
  const isOnParentPath = location.pathname === item.href;
  const isChildActive = item.children?.some((c) => currentPath === c.href) || false;
  const [expanded, setExpanded] = useState(isOnParentPath || isChildActive);

  // Auto-expand when navigating to this section
  useEffect(() => {
    if (isOnParentPath || isChildActive) setExpanded(true);
  }, [currentPath]);

  return (
    <div>
      <div className="flex items-center">
        <NavLink
          to={item.href}
          onClick={onClose}
          className={`sidebar-link flex-1 ${isOnParentPath ? 'active' : ''}`}
        >
          <item.icon className="w-5 h-5" />
          <span className="flex-1">{item.name}</span>
          {item.badge && (
            <span className="badge badge-primary text-[10px]">{item.badge}</span>
          )}
        </NavLink>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 mr-2 rounded-md text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
        >
          <ChevronDownIcon
            className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {item.children?.map((child) => {
              const isActive = currentPath === child.href || location.pathname === child.href;
              return (
                <Link
                  key={child.name}
                  to={child.href}
                  onClick={onClose}
                  className={`sidebar-link pl-11 text-sm ${isActive ? 'active' : ''}`}
                >
                  <child.icon className="w-4 h-4" />
                  <span className="flex-1">{child.name}</span>
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sidebar({ isOpen, onClose, isImpersonating }: SidebarProps) {
  const { user } = useAuthStore();

  const NavSection = ({ items, title }: { items: NavItem[]; title?: string }) => (
    <div className="mb-6">
      {title && (
        <h3 className="px-4 mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
          {title}
        </h3>
      )}
      <nav className="space-y-1">
        {items.map((item) =>
          item.children ? (
            <NavItemWithChildren key={item.name} item={item} onClose={onClose} />
          ) : (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onClose}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1">{item.name}</span>
              {item.badge && (
                <span className="badge badge-primary text-[10px]">{item.badge}</span>
              )}
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
        <span className="text-lg font-bold gradient-text">Menu</span>
        <button onClick={onClose} className="btn-icon">
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6 px-3">
        <NavSection items={mainNavItems} />
        <NavSection items={aiNavItems} title="AI Tools" />
        <NavSection items={settingsNavItems} title="Settings" />
      </div>

      {/* Upgrade card */}
      {user?.profile?.subscription_plan === 'free' && (
        <div className="p-4">
          <div className="card gradient-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="icon-wrapper-sm bg-gradient-accent">
                <GemIconCustom className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Upgrade to Pro</h4>
                <p className="text-xs text-text-secondary">Unlock all features</p>
              </div>
            </div>
            <button className="btn-primary w-full py-2 text-sm">
              Upgrade Now
            </button>
          </div>
        </div>
      )}
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
      <aside className={`hidden lg:flex lg:flex-col fixed left-0 ${isImpersonating ? 'top-[110px]' : 'top-[70px]'} bottom-[60px] w-[300px] bg-dark-800/95 backdrop-blur-xl border-r border-white/5 z-30`}>
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="lg:hidden fixed left-0 top-0 bottom-0 w-[300px] bg-dark-800 z-50"
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

export default Sidebar;
