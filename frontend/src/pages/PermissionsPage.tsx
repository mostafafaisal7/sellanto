import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { rbacService } from '../services/rbacService';

interface Workspace {
  id: number;
  name: string;
}

interface UserRole {
  id: number;
  user_id: number;
  username: string;
  email: string;
  role: string;
  granted_at: string;
}

const ROLES = [
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to analytics and content' },
  { value: 'creator', label: 'Creator', description: 'Can create and edit drafts' },
  { value: 'approver', label: 'Approver', description: 'Can approve/reject drafts' },
  { value: 'publisher', label: 'Publisher', description: 'Can schedule and publish posts' },
  { value: 'admin', label: 'Admin', description: 'Full workspace management' },
];

export function PermissionsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<number | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Invite form
  const [_inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteUserId, setInviteUserId] = useState('');

  useEffect(() => {
    api.get('/workspaces/').then(res => {
      const ws = res.data?.results || res.data || [];
      setWorkspaces(ws);
      if (ws.length > 0) setSelectedWorkspace(ws[0].id);
    });
  }, []);

  const loadRoles = useCallback(async () => {
    if (!selectedWorkspace) return;
    setLoading(true);
    setError('');
    try {
      const data = await rbacService.getWorkspaceRoles(selectedWorkspace);
      setRoles(Array.isArray(data) ? data : data.roles || []);
    } catch {
      setError('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspace || !inviteUserId) return;
    setError('');
    setSuccess('');
    try {
      await rbacService.assignRole(selectedWorkspace, parseInt(inviteUserId), inviteRole);
      setSuccess(`Role "${inviteRole}" assigned successfully`);
      setInviteUserId('');
      setInviteEmail('');
      loadRoles();
    } catch {
      setError('Failed to assign role');
    }
  };

  const handleRemoveRole = async (userId: number, role: string) => {
    if (!selectedWorkspace) return;
    setError('');
    setSuccess('');
    try {
      await rbacService.removeRole(selectedWorkspace, userId, role);
      setSuccess('Role removed successfully');
      loadRoles();
    } catch {
      setError('Failed to remove role');
    }
  };

  const handleChangeRole = async (userId: number, currentRole: string, newRole: string) => {
    if (!selectedWorkspace || currentRole === newRole) return;
    setError('');
    setSuccess('');
    try {
      await rbacService.removeRole(selectedWorkspace, userId, currentRole);
      await rbacService.assignRole(selectedWorkspace, userId, newRole);
      setSuccess('Role updated successfully');
      loadRoles();
    } catch {
      setError('Failed to update role');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Permissions Management</h1>
          <p className="text-gray-400 mt-1">Manage team roles and access for your workspace</p>
        </div>
        {workspaces.length > 1 && (
          <select
            value={selectedWorkspace || ''}
            onChange={(e) => setSelectedWorkspace(Number(e.target.value))}
            className="bg-gray-700 text-gray-200 border border-gray-600 rounded-lg px-3 py-2"
          >
            {workspaces.map(ws => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg p-3">
          {success}
        </div>
      )}

      {/* Assign Role Form */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Assign Role</h2>
        <form onSubmit={handleAssignRole} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-sm text-gray-400 mb-1">User ID</label>
            <input
              type="number"
              value={inviteUserId}
              onChange={(e) => setInviteUserId(e.target.value)}
              placeholder="User ID"
              className="bg-gray-700 text-gray-200 border border-gray-600 rounded-lg px-3 py-2 w-32"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="bg-gray-700 text-gray-200 border border-gray-600 rounded-lg px-3 py-2"
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Assign Role
          </button>
        </form>
      </div>

      {/* Role Descriptions */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Role Hierarchy</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {ROLES.map((r, i) => (
            <div key={r.value} className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-sm font-medium text-indigo-400">{r.label}</div>
              <div className="text-xs text-gray-400 mt-1">{r.description}</div>
              {i < ROLES.length - 1 && (
                <div className="text-gray-500 text-xs mt-1">Level {i + 1}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Current Roles Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">
          Current Team Roles
          {loading && <span className="text-sm text-gray-400 ml-2">Loading...</span>}
        </h2>

        {roles.length === 0 && !loading ? (
          <p className="text-gray-400">No roles assigned yet. Use the form above to add team members.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-3 px-4 text-sm font-medium text-gray-400">User</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-400">Email</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-400">Role</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-400">Granted</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((ur) => (
                  <tr key={`${ur.user_id}-${ur.role}`} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-3 px-4 text-gray-200">{ur.username}</td>
                    <td className="py-3 px-4 text-gray-400">{ur.email}</td>
                    <td className="py-3 px-4">
                      <select
                        value={ur.role}
                        onChange={(e) => handleChangeRole(ur.user_id, ur.role, e.target.value)}
                        className="bg-gray-700 text-gray-200 border border-gray-600 rounded px-2 py-1 text-sm"
                      >
                        {ROLES.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-sm">
                      {ur.granted_at ? new Date(ur.granted_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleRemoveRole(ur.user_id, ur.role)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default PermissionsPage;
