import api from './api';
import type {
  MessengerConnection,
  AIConfiguration,
  PDFKnowledgeBase,
  Conversation,
  CustomPrompt,
  Brand,
  BrandDNAStatus,
  ECommerceSettings,
  EComProduct,
} from '../types';

// Local notification type to avoid browser conflict
interface MessengerNotification {
  id: number;
  connection: number;
  conversation: number;
  message: number;
  notification_type: string;
  title: string;
  summary: string;
  priority: 'high' | 'medium' | 'low';
  is_read: boolean;
  is_resolved: boolean;
  resolved_at?: string;
  created_at: string;
}

interface MessengerDashboardStats {
  connections_count: number;
  active_connections: number;
  total_conversations: number;
  active_conversations: number;
  total_messages: number;
  unread_notifications: number;
  total_tokens: number;
  recent_conversations: Conversation[];
}

export const messengerService = {
  // Dashboard
  async getDashboard(): Promise<MessengerDashboardStats> {
    const response = await api.get<MessengerDashboardStats>('/messenger/dashboard/');
    return response.data;
  },

  // Connections
  async getConnections(): Promise<MessengerConnection[]> {
    const response = await api.get<MessengerConnection[]>('/messenger/connections/');
    return response.data;
  },

  async createConnection(data: Partial<MessengerConnection>): Promise<MessengerConnection> {
    const response = await api.post<MessengerConnection>('/messenger/connections/', data);
    return response.data;
  },

  async updateConnection(id: number, data: Partial<MessengerConnection>): Promise<MessengerConnection> {
    const response = await api.patch<MessengerConnection>(`/messenger/connections/${id}/`, data);
    return response.data;
  },

  async deleteConnection(id: number): Promise<void> {
    await api.delete(`/messenger/connections/${id}/`);
  },

  // Connect a new Facebook Page (convenience wrapper)
  async connectPage(data: {
    page_name: string;
    page_id: string;
    page_access_token: string;
    greeting_text: string;
    website_url?: string;
  }): Promise<MessengerConnection> {
    const response = await api.post<MessengerConnection>('/messenger/connections/', data);
    return response.data;
  },

  async toggleConnection(id: number): Promise<MessengerConnection> {
    const response = await api.post<MessengerConnection>(`/messenger/connections/${id}/toggle_active/`);
    return response.data;
  },

  // AI Configuration
  async getConfig(connectionId: number): Promise<AIConfiguration> {
    const response = await api.get<AIConfiguration>(`/messenger/connections/${connectionId}/config/`);
    return response.data;
  },

  async updateConfig(connectionId: number, data: Partial<AIConfiguration>): Promise<AIConfiguration> {
    const response = await api.patch<AIConfiguration>(`/messenger/connections/${connectionId}/config/`, data);
    return response.data;
  },

  async createOrUpdateConfig(connectionId: number, data: {
    openai_api_key: string;
    openai_model: string;
    embedding_model: string;
    rag_enabled: boolean;
    top_k_results: number;
    similarity_threshold: number;
    temperature: number;
    max_tokens: number;
    image_understanding_enabled: boolean;
  }): Promise<AIConfiguration> {
    // PATCH works because backend uses get_or_create
    const response = await api.patch<AIConfiguration>(`/messenger/connections/${connectionId}/config/`, data);
    return response.data;
  },

  // PDF Knowledge Base
  async getPDFs(connectionId: number): Promise<PDFKnowledgeBase[]> {
    const response = await api.get<PDFKnowledgeBase[]>(`/messenger/connections/${connectionId}/pdfs/`);
    return response.data;
  },

  async uploadPDF(connectionId: number, file: File): Promise<PDFKnowledgeBase> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', file.name);

    const response = await api.post<PDFKnowledgeBase>(
      `/messenger/connections/${connectionId}/pdfs/`,
      formData
    );
    return response.data;
  },

  async deletePDF(connectionId: number, pdfId: number): Promise<void> {
    await api.delete(`/messenger/connections/${connectionId}/pdfs/${pdfId}/`);
  },

  // Conversations
  async getConversations(connectionId: number): Promise<Conversation[]> {
    const response = await api.get<Conversation[]>(`/messenger/connections/${connectionId}/conversations/`);
    return response.data;
  },

  async getConversation(connectionId: number, conversationId: number): Promise<Conversation> {
    const response = await api.get<Conversation>(
      `/messenger/connections/${connectionId}/conversations/${conversationId}/`
    );
    return response.data;
  },

  async toggleTakeover(connectionId: number, conversationId: number): Promise<Conversation> {
    const response = await api.post<Conversation>(
      `/messenger/connections/${connectionId}/conversations/${conversationId}/toggle-takeover/`
    );
    return response.data;
  },

  async sendMessage(connectionId: number, conversationId: number, content: string): Promise<void> {
    await api.post(`/messenger/connections/${connectionId}/conversations/${conversationId}/send-message/`, {
      content,
    });
  },

  // Custom Prompts
  async getPrompts(connectionId: number): Promise<CustomPrompt[]> {
    const response = await api.get<CustomPrompt[]>(`/messenger/connections/${connectionId}/prompts/`);
    return response.data;
  },

  async createPrompt(connectionId: number, data: Partial<CustomPrompt>): Promise<CustomPrompt> {
    const response = await api.post<CustomPrompt>(`/messenger/connections/${connectionId}/prompts/`, data);
    return response.data;
  },

  async updatePrompt(connectionId: number, promptId: number, data: Partial<CustomPrompt>): Promise<CustomPrompt> {
    const response = await api.put<CustomPrompt>(
      `/messenger/connections/${connectionId}/prompts/${promptId}/`,
      data
    );
    return response.data;
  },

  async deletePrompt(connectionId: number, promptId: number): Promise<void> {
    await api.delete(`/messenger/connections/${connectionId}/prompts/${promptId}/`);
  },

  async activatePrompt(connectionId: number, promptId: number): Promise<CustomPrompt> {
    const response = await api.post<CustomPrompt>(
      `/messenger/connections/${connectionId}/prompts/${promptId}/activate/`
    );
    return response.data;
  },

  // Notifications
  async getNotifications(): Promise<MessengerNotification[]> {
    const response = await api.get<MessengerNotification[]>('/messenger/notifications/');
    return response.data;
  },

  async markNotificationRead(id: number): Promise<MessengerNotification> {
    const response = await api.post<MessengerNotification>(`/messenger/notifications/${id}/mark_read/`);
    return response.data;
  },

  async resolveNotification(id: number): Promise<MessengerNotification> {
    const response = await api.post<MessengerNotification>(`/messenger/notifications/${id}/resolve/`);
    return response.data;
  },

  async markAllNotificationsRead(): Promise<void> {
    await api.post('/messenger/notifications/mark_all_read/');
  },

  // Website Knowledge Base (crawl website for AI knowledge)
  async crawlWebsite(connectionId: number, websiteUrl?: string): Promise<{
    success: boolean;
    pages_crawled?: number;
    total_chunks?: number;
    website_url?: string;
    message?: string;
    error?: string;
  }> {
    const response = await api.post(`/messenger/connections/${connectionId}/crawl-website/`, {
      website_url: websiteUrl,
    });
    return response.data;
  },

  async getWebsiteStatus(connectionId: number): Promise<{
    website_url: string | null;
    has_data: boolean;
    chunk_count: number;
    pages_crawled: number;
    generated_at: string | null;
  }> {
    const response = await api.get(`/messenger/connections/${connectionId}/crawl-website/`);
    return response.data;
  },

  // Brand DNA (legacy)
  async getUserBrands(): Promise<Brand[]> {
    const response = await api.get<Brand[]>('/brands/');
    return response.data;
  },

  async generateBrandDNA(brandId: number): Promise<{ success: boolean; pages_crawled?: number; total_chunks?: number; message?: string; error?: string }> {
    const response = await api.post(`/brands/${brandId}/generate-dna/`);
    return response.data;
  },

  async getBrandDNAStatus(brandId: number): Promise<BrandDNAStatus> {
    const response = await api.get<BrandDNAStatus>(`/brands/${brandId}/dna-status/`);
    return response.data;
  },

  // E-Commerce
  async getECommerceSettings(connectionId: number): Promise<ECommerceSettings> {
    const response = await api.get<ECommerceSettings>(`/messenger/connections/${connectionId}/ecommerce/`);
    return response.data;
  },

  async updateECommerceSettings(connectionId: number, data: Partial<ECommerceSettings>): Promise<ECommerceSettings> {
    const response = await api.patch<ECommerceSettings>(`/messenger/connections/${connectionId}/ecommerce/`, data);
    return response.data;
  },

  async testECommerceConnection(connectionId: number): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/messenger/connections/${connectionId}/ecommerce/test/`);
    return response.data;
  },

  async syncProducts(connectionId: number): Promise<{ success: boolean; synced?: number; created?: number; updated?: number; error?: string }> {
    const response = await api.post(`/messenger/connections/${connectionId}/ecommerce/sync/`);
    return response.data;
  },

  async regenerateProductEmbeddings(connectionId: number): Promise<{ success: boolean; total?: number; error?: string }> {
    const response = await api.post(`/messenger/connections/${connectionId}/ecommerce/embeddings/`);
    return response.data;
  },

  async getProducts(connectionId: number): Promise<EComProduct[]> {
    const response = await api.get<EComProduct[]>(`/messenger/connections/${connectionId}/ecommerce/products/`);
    return response.data;
  },
};

export default messengerService;
