import api from './api';
import type { Post, CreatePostData, UpdatePostData, PostFilters, PaginatedResponse } from '../types';

export const postService = {
  async list(filters?: PostFilters): Promise<PaginatedResponse<Post>> {
    const response = await api.get<PaginatedResponse<Post>>('/posts/', { params: filters });
    return response.data;
  },

  async get(id: number): Promise<Post> {
    const response = await api.get<Post>(`/posts/${id}/`);
    return response.data;
  },

  async create(data: CreatePostData): Promise<Post> {
    const formData = new FormData();
    formData.append('caption', data.caption);
    formData.append('platforms', JSON.stringify(data.platforms));
    formData.append('scheduled_time', data.scheduled_time);
    formData.append('timezone', data.timezone);

    if (data.brand) {
      formData.append('brand', String(data.brand));
    }
    if (data.pillar) {
      formData.append('pillar', String(data.pillar));
    }
    if (data.goal) {
      formData.append('goal', data.goal);
    }

    data.media_files.forEach((file, index) => {
      formData.append(`media_${index}`, file);
    });

    try {
      // Don't set Content-Type manually for FormData - axios will set it with proper boundary
      const response = await api.post<Post>('/posts/', formData);
      return response.data;
    } catch (error: unknown) {
      // Extract meaningful error message from backend response
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: Record<string, unknown>; status?: number } };
        const responseData = axiosError.response?.data;
        if (responseData) {
          // Handle different error formats
          let errorMessage: string | null = null;

          // Direct error fields
          if (typeof responseData.error === 'string') {
            errorMessage = responseData.error;
          } else if (typeof responseData.message === 'string') {
            errorMessage = responseData.message;
          } else if (typeof responseData.detail === 'string') {
            errorMessage = responseData.detail;
          } else {
            // Handle DRF validation errors (field: [errors])
            const errorParts: string[] = [];
            for (const [field, value] of Object.entries(responseData)) {
              if (Array.isArray(value) && value.length > 0) {
                errorParts.push(`${field}: ${value.join(', ')}`);
              } else if (typeof value === 'string') {
                errorParts.push(`${field}: ${value}`);
              }
            }
            if (errorParts.length > 0) {
              errorMessage = errorParts.join('; ');
            }
          }

          if (errorMessage) {
            throw new Error(errorMessage);
          }
        }
        // Handle HTTP status-based errors
        if (axiosError.response?.status === 401) {
          throw new Error('Session expired. Please log in again.');
        } else if (axiosError.response?.status === 403) {
          throw new Error('You do not have permission to perform this action.');
        } else if (axiosError.response?.status === 404) {
          throw new Error('Resource not found.');
        } else if (axiosError.response?.status && axiosError.response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }
      }
      throw error;
    }
  },

  async update(id: number, data: UpdatePostData): Promise<Post> {
    const response = await api.put<Post>(`/posts/${id}/`, data);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/posts/${id}/`);
  },

  async cancel(id: number): Promise<Post> {
    const response = await api.post<Post>(`/posts/${id}/cancel/`);
    return response.data;
  },

  async uploadMedia(files: File[]): Promise<string[]> {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`file_${index}`, file);
    });

    const response = await api.post<{ urls: string[] }>('/posts/upload/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.urls;
  },
};

export default postService;
