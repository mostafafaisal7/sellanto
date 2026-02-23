import api from './api';

export const calendarService = {
  async getCalendarEvents(start?: string, end?: string) {
    const params: Record<string, string> = {};
    if (start) params.start = start;
    if (end) params.end = end;
    const res = await api.get('/schedule/calendar/', { params });
    return res.data;
  },
  async schedulePost(postId: number, platforms: Array<{ platform: string; caption_id?: number; scheduled_at: string; timezone?: string; hashtag_placement?: string }>) {
    const res = await api.post(`/drafts/${postId}/schedule/`, { platforms });
    return res.data;
  },
  async reschedule(scheduledPostId: number, scheduledAt: string) {
    const res = await api.patch(`/scheduled-posts/${scheduledPostId}/`, { scheduled_at: scheduledAt });
    return res.data;
  },
  async checkConflict(platform: string, scheduledAt: string, bufferMinutes?: number) {
    const res = await api.post('/schedule/conflict-check/', { platform, scheduled_at: scheduledAt, buffer_minutes: bufferMinutes || 30 });
    return res.data;
  },
  async getBestTimes(brandId: number, platform?: string) {
    const params = platform ? { platform } : {};
    const res = await api.get(`/brands/${brandId}/best-times/`, { params });
    return res.data;
  },
};

export default calendarService;
