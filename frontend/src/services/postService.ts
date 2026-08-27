import api from './api';
import type { Post, CreatePostData, UpdatePostData, PostFilters, PaginatedResponse, PlatformLink } from '../types';

/** Pull the backend's own message out of an axios error, so the user sees why
 *  a publish was refused ("already posted") instead of a generic failure. */
function apiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: Record<string, unknown> } }).response?.data;
    for (const key of ['error', 'detail', 'message']) {
      const value = data?.[key];
      if (typeof value === 'string' && value) return value;
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

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
    if (data.scheduled_time) {
      formData.append('scheduled_time', data.scheduled_time);
    }
    if (data.timezone) {
      formData.append('timezone', data.timezone);
    }

    if (data.brand) {
      formData.append('brand', String(data.brand));
    }
    if (data.pillar) {
      formData.append('pillar', String(data.pillar));
    }
    if (data.goal) {
      formData.append('goal', data.goal);
    }
    if (data.source) {
      formData.append('source', data.source);
    }
    if (data.status) {
      formData.append('status', data.status);
    }
    if (data.hook) {
      formData.append('hook', data.hook);
    }

    console.log('[PostService] media_files count:', data.media_files?.length, 'files:', data.media_files?.map(f => f?.name));
    (data.media_files || []).forEach((file, index) => {
      console.log(`[PostService] Appending media_${index}:`, file?.name, file?.size, file?.type);
      formData.append(`media_${index}`, file);
    });

    // Attach already-generated media by reference (image URLs / paths the user
    // owns, or a generated video by id) instead of re-uploading from the browser.
    if (data.media_paths && data.media_paths.length > 0) {
      formData.append('media_paths', JSON.stringify(data.media_paths));
    }
    if (data.video_generation_id != null) {
      formData.append('video_generation_id', String(data.video_generation_id));
    }

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

  /** Publish immediately rather than waiting for the scheduler's next tick.
   *  The backend runs the same publish_post() the scheduler runs. */
  async publishNow(id: number): Promise<Post> {
    try {
      const response = await api.post<Post>(`/posts/${id}/publish/`);
      return response.data;
    } catch (error: unknown) {
      throw new Error(apiErrorMessage(error, 'Could not publish this post.'));
    }
  },

  /** Public URLs for the post on each platform it actually reached. */
  async getLinks(id: number): Promise<PlatformLink[]> {
    const response = await api.get<{ links: PlatformLink[] }>(`/posts/${id}/links/`);
    return response.data.links || [];
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
