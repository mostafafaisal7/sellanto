import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminNavbar } from './AdminNavbar';
import { AdminSidebar } from './AdminSidebar';
import { UserSelectModal } from './UserSelectModal';

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserSelect, setShowUserSelect] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen" style={{ background: 'rgb(8, 15, 30)' }}>
      <AdminNavbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onImpersonateClick={() => setShowUserSelect(true)}
      />

      <main className="pt-[70px] lg:ml-[260px]">
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

      <UserSelectModal
        isOpen={showUserSelect}
        onClose={() => setShowUserSelect(false)}
      />
    </div>
  );
}

export default AdminLayout;
