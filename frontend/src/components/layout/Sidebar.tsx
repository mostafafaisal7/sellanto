import { useState, useEffect } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HomeIcon,
  PlusCircleIcon,
  DocumentTextIcon,
  LinkIcon,
  SparklesIcon,
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
  DocumentDuplicateIcon,
  ArrowPathIcon,
  ChatBubbleBottomCenterTextIcon,
  ArrowUpCircleIcon,
  ChartBarSquareIcon,
  ChatBubbleLeftRightIcon,
  HashtagIcon,
  UserGroupIcon,
  MegaphoneIcon,
  PhotoIcon,
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
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  {
    name: 'Strategy Hub', href: '/strategy', icon: MapIcon,
    children: [
      { name: 'Brand DNA', href: '/strategy?tab=dna', icon: SparklesIcon },
      { name: 'Content Pillars', href: '/strategy?tab=pillars', icon: ChartBarIcon },
      { name: 'Competitors', href: '/strategy?tab=competitors', icon: MapIcon },
      { name: 'Trending', href: '/strategy?tab=trending', icon: LightBulbIcon },
    ],
  },
  {
    name: 'Ideas Hub', href: '/ideas', icon: LightBulbIcon,
    children: [
      { name: 'Idea History', href: '/ideas/history', icon: ClockIcon },
    ],
  },
  {
    name: 'Magic Link', href: '/magic', icon: SparklesIcon,
    children: [
      { name: 'Magic History', href: '/magic/history', icon: ClockIcon },
    ],
  },
  {
    name: 'Overflow', href: '/overflow', icon: ArrowPathIcon,
    children: [
      { name: 'Overflow History', href: '/overflow/history', icon: ClockIcon },
    ],
  },
  {
    name: 'Post', href: '#posts', icon: DocumentTextIcon,
    children: [
      { name: 'All Post', href: '/posts', icon: DocumentTextIcon },
      { name: 'Post', href: '/posts/create', icon: PlusCircleIcon },
      { name: 'Draft Post', href: '/posts/drafts', icon: DocumentDuplicateIcon },
    ],
  },
  { name: 'Messenger Bot', href: '/messenger', icon: ChatBubbleBottomCenterTextIcon },
  { name: 'Calendar', href: '/calendar', icon: CalendarDaysIcon },
  { name: 'Connect Account', href: '/platforms', icon: LinkIcon },
  {
    name: 'Engage', href: '#engage', icon: ChatBubbleLeftRightIcon,
    children: [
      { name: 'Comments', href: '/comments', icon: ChatBubbleLeftRightIcon },
      { name: 'Instagram Content', href: '/instagram-content', icon: PhotoIcon },
      { name: 'Discover', href: '/discover', icon: HashtagIcon },
      { name: 'Leads', href: '/leads', icon: UserGroupIcon },
      { name: 'Ads', href: '/ads', icon: MegaphoneIcon },
    ],
  },
];

const settingsNavItems: NavItem[] = [
  { name: 'Upgrade Plan', href: '/upgrade', icon: ArrowUpCircleIcon, badge: 'Pro' },
  { name: 'Buy Diamonds', href: '/buy-diamonds', icon: SparklesIcon },
  { name: 'Diamond Analytics', href: '/analytics/diamond', icon: ChartBarSquareIcon },

  { name: 'Profile', href: '/profile', icon: UserIcon },
  { name: 'Business Profile', href: '/business-profile', icon: BuildingOfficeIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

function NavItemWithChildren({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const location = useLocation();
  const currentPath = location.pathname + location.search;
  const isNonNavigable = item.href.startsWith('#');
  const isOnParentPath = !isNonNavigable && location.pathname === item.href;
  const isChildActive = item.children?.some((c) => currentPath === c.href || location.pathname === c.href) || false;
  const [expanded, setExpanded] = useState(isOnParentPath || isChildActive);

  useEffect(() => {
    if (isOnParentPath || isChildActive) setExpanded(true);
  }, [currentPath]);

  return (
    <div>
      <div className="flex items-center">
        {isNonNavigable ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className={`nav-item flex-1 text-left ${isChildActive ? 'active' : ''}`}
          >
            <item.icon className="w-[18px] h-[18px]" />
            <span className="flex-1">{item.name}</span>
          </button>
        ) : (
          <NavLink
            to={item.href}
            onClick={onClose}
            className={`nav-item flex-1 ${isOnParentPath ? 'active' : ''}`}
          >
            <item.icon className="w-[18px] h-[18px]" />
            <span className="flex-1">{item.name}</span>
          </NavLink>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 mr-2 rounded-md text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
        >
          <ChevronDownIcon
            className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
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
                  className={`nav-item pl-11 text-[12.5px] !py-[6px] !rounded-[8px] ${isActive ? 'active' : ''}`}
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
  const navigate = useNavigate();
  const [messengerEnabled, setMessengerEnabled] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    fetch('/api/v1/platforms/facebook/status/', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && typeof data.messenger_enabled === 'boolean') {
          setMessengerEnabled(data.messenger_enabled);
        }
      })
      .catch(() => {});
  }, []);

  const filteredNavItems = messengerEnabled
    ? mainNavItems
    : mainNavItems.filter(item => item.href !== '/messenger');

  const NavSection = ({ items, title }: { items: NavItem[]; title?: string }) => (
    <div className="mb-5">
      {title && (
        <h3
          className="px-4 mb-2 uppercase tracking-wider"
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            color: 'rgb(var(--c-text-muted))',
            letterSpacing: '1.2px',
          }}
        >
          {title}
        </h3>
      )}
      <nav className="space-y-0.5">
        {items.map((item) =>
          item.children ? (
            <NavItemWithChildren key={item.name} item={item} onClose={onClose} />
          ) : (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onClose}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
              <span className="flex-1">{item.name}</span>
            </NavLink>
          )
        )}
      </nav>
    </div>
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo (desktop) */}
      <div className="hidden lg:flex items-center gap-3 px-[18px] pt-[18px] pb-[14px]">
        <div
          className="w-8 h-8 rounded-[10px] flex items-center justify-center text-white font-black text-sm"
          style={{
            background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
          }}
        >
          S
        </div>
        <span className="text-[18px] font-bold text-text-primary">Sellanto</span>
      </div>

      {/* Mobile close button */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs"
            style={{
              background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
            }}
          >
            S
          </div>
          <span className="text-base font-bold">Sellanto</span>
        </div>
        <button onClick={onClose} className="btn-icon">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3 no-scrollbar">
        <NavSection items={filteredNavItems} />
        <NavSection items={settingsNavItems} title="Settings" />
      </div>

      {/* Upgrade card */}
      {user?.profile?.subscription_plan === 'free' && (
        <div className="p-3">
          <div
            className="p-4 rounded-xl"
            style={{
              background: 'rgba(232, 54, 79, 0.08)',
              border: '1px solid rgba(232, 54, 79, 0.2)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span>💎</span>
              <span className="text-sm font-bold text-text-primary">Upgrade to Pro</span>
            </div>
            <p className="text-xs text-text-secondary mb-3">Unlock all AI features</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  navigate('/upgrade');
                  onClose();
                }}
                className="btn-primary w-full py-2 text-xs"
              >
                Upgrade Now
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate('/buy-diamonds');
                  onClose();
                }}
                className="w-full py-2 text-xs font-bold rounded-lg transition-colors"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-primary)',
                }}
              >
                Buy Diamonds
              </button>
            </div>

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
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col fixed left-0 ${isImpersonating ? 'top-[96px]' : 'top-0'} bottom-0 w-[230px] z-30`}
        style={{
          background: 'rgb(var(--c-bg-secondary))',
          borderRight: '1px solid var(--border-color)',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ x: -230 }}
            animate={{ x: 0 }}
            exit={{ x: -230 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="lg:hidden fixed left-0 top-0 bottom-0 w-[230px] z-50"
            style={{ background: 'rgb(var(--c-bg-secondary))' }}
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

export default Sidebar;
