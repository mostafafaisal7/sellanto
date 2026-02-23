import api from './api';
import type { OnboardingProgress, Workspace, Brand, LaunchPlan } from '../types';

const onboardingService = {
  // Onboarding Progress
  getProgress: async (): Promise<OnboardingProgress> => {
    const { data } = await api.get('/onboarding/');
    return data;
  },

  completeStep: async (stepNumber: number): Promise<OnboardingProgress> => {
    const { data } = await api.post(`/onboarding/step/${stepNumber}/`);
    return data;
  },

  skipOnboarding: async (): Promise<OnboardingProgress> => {
    const { data } = await api.post('/onboarding/skip/');
    return data;
  },

  // Workspace
  createWorkspace: async (workspaceData: Partial<Workspace>): Promise<Workspace> => {
    const { data } = await api.post('/workspaces/', workspaceData);
    return data;
  },

  getWorkspaces: async (): Promise<Workspace[]> => {
    const { data } = await api.get('/workspaces/');
    return data.results || data;
  },

  // Brand
  createBrand: async (brandData: FormData | Partial<Brand>): Promise<Brand> => {
    const { data } = await api.post('/brands/', brandData, {
      headers: brandData instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
    return data;
  },

  getBrands: async (workspaceId?: number): Promise<Brand[]> => {
    const params = workspaceId ? { workspace: workspaceId } : {};
    const { data } = await api.get('/brands/', { params });
    return data.results || data;
  },

  updateBrand: async (brandId: number, brandData: FormData | Partial<Brand>): Promise<Brand> => {
    const { data } = await api.patch(`/brands/${brandId}/`, brandData, {
      headers: brandData instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
    return data;
  },

  // Launch Plan
  createLaunchPlan: async (planData: Partial<LaunchPlan>): Promise<LaunchPlan> => {
    const { data } = await api.post('/launch-plans/', planData);
    return data;
  },

  getLaunchPlan: async (brandId: number): Promise<LaunchPlan> => {
    const { data } = await api.get(`/brands/${brandId}/launch-plan/`);
    return data;
  },
};

export default onboardingService;
