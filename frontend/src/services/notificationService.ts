import api from './api';

export const notificationService = {
  async getNotifications(params?: { event_type?: string; is_read?: string; limit?: number }) {
    const res = await api.get('/notifications/', { params });
    return res.data;
  },
  async getUnreadCount() {
    const res = await api.get('/notifications/unread-count/');
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
