import api from './api';

export const rbacService = {
  async getWorkspaceRoles(workspaceId: number) {
    const res = await api.get(`/workspaces/${workspaceId}/roles/`);
    return res.data;
  },

  async assignRole(workspaceId: number, userId: number, role: string) {
    const res = await api.post(`/workspaces/${workspaceId}/roles/assign/`, {
      user_id: userId,
      role,
    });
    return res.data;
  },

  async removeRole(workspaceId: number, userId: number, role: string) {
    const res = await api.post(`/workspaces/${workspaceId}/roles/remove/`, {
      user_id: userId,
      role,
    });
    return res.data;
  },

  async getMyRoles() {
    const res = await api.get('/my-roles/');
    return res.data;
  },
};

export default rbacService;
