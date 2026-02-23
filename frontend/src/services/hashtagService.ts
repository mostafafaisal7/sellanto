import api from './api';

export const hashtagService = {
  async getHashtags(postId: number) {
    const res = await api.get(`/drafts/${postId}/hashtags/`);
    return res.data;
  },
  async generateHashtags(postId: number, data: { platform: string; topic?: string; count?: number }) {
    const res = await api.post(`/drafts/${postId}/hashtags/generate/`, data);
    return res.data;
  },
  async toggleHashtag(hashtagId: number, data: { is_selected?: boolean; placement?: string }) {
    const res = await api.patch(`/hashtags/${hashtagId}/`, data);
    return res.data;
  },

  // Hashtag Groups
  async getGroups(brandId: number) {
    const res = await api.get('/hashtag-groups/', { params: { brand_id: brandId } });
    return res.data;
  },
  async createGroup(data: { brand: number; name: string; tags: string[] }) {
    const res = await api.post('/hashtag-groups/', data);
    return res.data;
  },
  async deleteGroup(id: number) {
    await api.delete(`/hashtag-groups/${id}/`);
  },

  // Banned Hashtags
  async getBanned(brandId: number) {
    const res = await api.get('/banned-hashtags/', { params: { brand_id: brandId } });
    return res.data;
  },
  async addBanned(data: { brand: number; tag: string; reason?: string }) {
    const res = await api.post('/banned-hashtags/', data);
    return res.data;
  },
  async removeBanned(id: number) {
    await api.delete(`/banned-hashtags/${id}/`);
  },
};

export default hashtagService;
