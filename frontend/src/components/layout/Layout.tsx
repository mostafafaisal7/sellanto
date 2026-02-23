import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldExclamationIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { SupportChatbot } from './SupportChatbot';
import { useAdminStore } from '../../store';

function ImpersonationBanner() {
  const { impersonatedUser, stopImpersonation } = useAdminStore();

  if (!impersonatedUser) return null;

  const handleExit = () => {
    stopImpersonation();
    window.location.href = '/admin-panel';
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-black">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldExclamationIcon className="w-5 h-5" />
          <span className="text-sm font-medium">
            Viewing as <strong>{impersonatedUser.username}</strong> ({impersonatedUser.email})
          </span>
        </div>
        <button
          onClick={handleExit}
          className="flex items-center gap-1.5 px-3 py-1 bg-black/20 hover:bg-black/30 rounded-lg text-sm font-medium transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Admin
        </button>
      </div>
    </div>
  );
}

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const location = useLocation();
  const { impersonatedUser } = useAdminStore();
  const isImpersonating = !!impersonatedUser;

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <div className="min-h-screen bg-dark-800">
      {isImpersonating && <ImpersonationBanner />}
      <Navbar
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        onChatToggle={() => setChatOpen((prev) => !prev)}
        isChatOpen={chatOpen}
        isImpersonating={isImpersonating}
      />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isImpersonating={isImpersonating} />

      <main className={`${isImpersonating ? 'pt-[110px]' : 'pt-[70px]'} pb-[60px] lg:ml-[280px]`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="p-4 lg:p-6"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />
      <SupportChatbot isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}

export default Layout;
