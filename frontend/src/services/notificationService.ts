import api from './api';

export const notificationService = {
  async getNotifications(params?: { event_type?: string; is_read?: string; limit?: number }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await api.get('/notifications/', { params, _silentError: true } as any);
    return res.data;
  },
  async getUnreadCount() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await api.get('/notifications/unread-count/', { _silentError: true } as any);
    return res.data;
  },
  async markRead(notificationId: number) {
    const res = await api.patch(`/notifications/${notificationId}/read/`);
    return res.data;
  },
  async markAllRead() {
    const res = await api.patch('/notifications/mark-all-read/');
    return res.data;
  },
  async deleteNotification(notificationId: number) {
    await api.delete(`/notifications/${notificationId}/`);
  },
};

export default notificationService;
