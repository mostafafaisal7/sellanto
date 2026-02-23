import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  UserGroupIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { useAdminStore } from '../../store';

export function AdminUsersPage() {
  const { users, usersLoading, fetchUsers, approveUser, rejectUser, bulkApprove, startImpersonation } = useAdminStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);


  useEffect(() => {
    fetchUsers({ status: statusFilter, search, plan: planFilter });
  }, [statusFilter, planFilter, fetchUsers]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchUsers({ status: statusFilter, search, plan: planFilter });
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const handleApprove = async (userId: number) => {
    await approveUser(userId);
    fetchUsers({ status: statusFilter, search, plan: planFilter });
  };

  const handleReject = async (userId: number) => {
    await rejectUser(userId);
    fetchUsers({ status: statusFilter, search, plan: planFilter });
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    await bulkApprove(selectedIds);
    setSelectedIds([]);
    fetchUsers({ status: statusFilter, search, plan: planFilter });
  };

  const handleImpersonate = (user: { id: number; username: string; email: string }) => {
    startImpersonation(user.id, user);
    window.location.href = '/';
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map(u => u.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-sm text-slate-400 mt-1">{users.length} users found</p>
        </div>
        {selectedIds.length > 0 && (
          <button
            onClick={handleBulkApprove}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Approve Selected ({selectedIds.length})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 text-white text-sm rounded-xl border border-white/10 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/30 transition-all"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <FunnelIcon className="w-4 h-4 text-slate-500" />
          {['', 'pending', 'approved'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === s
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {s === '' ? 'All' : s === 'pending' ? 'Pending' : 'Approved'}
            </button>
          ))}
        </div>

        {/* Plan Filter */}
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-3 py-2 bg-dark-700 text-white text-sm rounded-xl border border-white/10 focus:outline-none focus:border-amber-500/30"
        >
          <option value="" className="bg-dark-800 text-white">All Plans</option>
          <option value="free" className="bg-dark-800 text-white">Free</option>
          <option value="starter" className="bg-dark-800 text-white">Starter</option>
          <option value="pro" className="bg-dark-800 text-white">Pro</option>
          <option value="business" className="bg-dark-800 text-white">Business</option>
          <option value="enterprise" className="bg-dark-800 text-white">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden overflow-x-auto">
        {usersLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === users.length && users.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-600"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Posts</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Tokens</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Cost</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">API Mode</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user, i) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(user.id)}
                      onChange={() => toggleSelect(user.id)}
                      className="rounded border-slate-600"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {user.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{user.username}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${
                      user.plan === 'enterprise' ? 'bg-purple-500/10 text-purple-400' :
                      user.plan === 'business' ? 'bg-blue-500/10 text-blue-400' :
                      user.plan === 'pro' ? 'bg-amber-500/10 text-amber-400' :
                      user.plan === 'starter' ? 'bg-green-500/10 text-green-400' :
                      'bg-slate-500/10 text-slate-400'
                    }`}>
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${
                      user.is_approved ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {user.is_approved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">{user.post_count}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{user.total_tokens.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">${user.estimated_cost}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${
                      user.api_mode === 'admin' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      {user.api_mode === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={`/admin-panel/users/${user.id}`}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </Link>
                      {!user.is_approved && (
                        <button
                          onClick={() => handleApprove(user.id)}
                          className="p-1.5 text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                          title="Approve"
                        >
                          <CheckCircleIcon className="w-4 h-4" />
                        </button>
                      )}
                      {user.is_approved && (
                        <button
                          onClick={() => handleReject(user.id)}
                          className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          title="Reject"
                        >
                          <XCircleIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleImpersonate(user)}
                        className="p-1.5 text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors"
                        title="Impersonate"
                      >
                        <UserGroupIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AdminUsersPage;
