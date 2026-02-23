import api from './api';
import type { SocialAccount, PlatformType } from '../types';

export interface ConnectAccountData {
  platform: PlatformType;
  account_name: string;
  // Platform-specific fields
  facebook_page_id?: string;
  facebook_access_token?: string;
  twitter_api_key?: string;
  twitter_api_secret?: string;
  twitter_access_token?: string;
  twitter_access_token_secret?: string;
  instagram_access_token?: string;
  instagram_business_account_id?: string;
  linkedin_access_token?: string;
  linkedin_person_urn?: string;
  telegram_bot_token?: string;
  telegram_channel_id?: string;
}

export const platformService = {
  async list(): Promise<SocialAccount[]> {
    const response = await api.get<SocialAccount[]>('/platforms/');
    return response.data;
  },

  async connect(data: ConnectAccountData): Promise<SocialAccount> {
    const response = await api.post<SocialAccount>('/platforms/', data);
    return response.data;
  },

  async disconnect(id: number): Promise<void> {
    await api.delete(`/platforms/${id}/`);
  },

  async validate(id: number): Promise<{ valid: boolean; error?: string }> {
    const response = await api.post<{ valid: boolean; error?: string }>(`/platforms/${id}/validate/`);
    return response.data;
  },

  async getGroupedAccounts(): Promise<Record<PlatformType, SocialAccount[]>> {
    const accounts = await this.list();
    return accounts.reduce((acc, account) => {
      if (!acc[account.platform]) {
        acc[account.platform] = [];
      }
      acc[account.platform].push(account);
      return acc;
    }, {} as Record<PlatformType, SocialAccount[]>);
  },
};

export default platformService;
