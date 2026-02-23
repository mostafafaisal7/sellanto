import api from './api';

export const creativeService = {
  async generateAltText(assetId: number) {
    const res = await api.post(`/assets/${assetId}/alt-text/`);
    return res.data;
  },

  async resizeAsset(assetId: number) {
    const res = await api.post(`/assets/${assetId}/resize/`);
    return res.data;
  },

  async applyTemplate(assetId: number, templateId: number) {
    const res = await api.post(`/assets/${assetId}/apply-template/`, {
      template_id: templateId,
    });
    return res.data;
  },

  async getVersions(assetId: number) {
    const res = await api.get(`/assets/${assetId}/versions/`);
    return res.data;
  },

  async getBrandTemplates() {
    const res = await api.get('/brand-templates/');
    return res.data;
  },
};

export default creativeService;
