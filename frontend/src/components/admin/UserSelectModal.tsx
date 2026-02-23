import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, MagnifyingGlassIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useAdminStore } from '../../store';

interface UserSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserSelectModal({ isOpen, onClose }: UserSelectModalProps) {
  const [search, setSearch] = useState('');
  const { users, usersLoading, fetchUsers, startImpersonation } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, fetchUsers]);

  useEffect(() => {
    if (isOpen && search) {
      const timeout = setTimeout(() => {
        fetchUsers({ search });
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [search, isOpen, fetchUsers]);

  const handleSelectUser = (user: { id: number; username: string; email: string }) => {
    startImpersonation(user.id, user);
    onClose();
    navigate('/');
    // Force page reload to refetch all data as impersonated user
    window.location.href = '/';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
              style={{ background: 'rgb(15, 23, 42)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <div>
                  <h2 className="text-lg font-bold text-white">Impersonate User</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Select a user to view their dashboard</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <XMarkIcon className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Search */}
              <div className="px-6 py-3 border-b border-white/5">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by username or email..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 text-white text-sm rounded-xl border border-white/10 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/20 transition-all"
                    autoFocus
                  />
                </div>
              </div>

              {/* User List */}
              <div className="max-h-[400px] overflow-y-auto">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <UserCircleIcon className="w-12 h-12 text-slate-600 mb-2" />
                    <p className="text-sm text-slate-500">No users found</p>
                  </div>
                ) : (
                  <div className="py-2">
                    {users.filter(u => !u.is_approved || u.is_approved).map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleSelectUser({ id: user.id, username: user.username, email: user.email })}
                        className="w-full flex items-center gap-3 px-6 py-3 hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                          {user.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{user.username}</p>
                          <p className="text-xs text-slate-400 truncate">{user.email}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${
                            user.plan === 'enterprise' ? 'bg-purple-500/10 text-purple-400' :
                            user.plan === 'business' ? 'bg-blue-500/10 text-blue-400' :
                            user.plan === 'pro' ? 'bg-amber-500/10 text-amber-400' :
                            user.plan === 'starter' ? 'bg-green-500/10 text-green-400' :
                            'bg-slate-500/10 text-slate-400'
                          }`}>
                            {user.plan}
                          </span>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {user.is_approved ? 'Approved' : 'Pending'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default UserSelectModal;
