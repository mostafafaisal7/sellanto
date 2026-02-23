import api from './api';

export const approvalService = {
  async submitForApproval(postId: number, comment?: string) {
    const res = await api.post(`/drafts/${postId}/submit/`, { comment });
    return res.data;
  },
  async approve(postId: number, comment?: string) {
    const res = await api.post(`/drafts/${postId}/approve/`, { comment });
    return res.data;
  },
  async requestChanges(postId: number, comment: string) {
    const res = await api.post(`/drafts/${postId}/request-changes/`, { comment });
    return res.data;
  },
  async reject(postId: number, rejectionReason: string, comment?: string) {
    const res = await api.post(`/drafts/${postId}/reject/`, { rejection_reason: rejectionReason, comment });
    return res.data;
  },
  async getPending() {
    const res = await api.get('/approvals/pending/');
    return res.data;
  },
  async getApprovalLog(postId: number) {
    const res = await api.get(`/drafts/${postId}/approval-log/`);
    return res.data;
  },
  async getChecklist(postId: number) {
    const res = await api.get(`/drafts/${postId}/checklist/`);
    return res.data;
  },
};

export default approvalService;
