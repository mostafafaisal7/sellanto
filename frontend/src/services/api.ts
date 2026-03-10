import axios from 'axios';
import type { AuthTokens } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// Token management
const getAccessToken = (): string | null => {
  return localStorage.getItem('access_token');
};

const getRefreshToken = (): string | null => {
  return localStorage.getItem('refresh_token');
};

const setTokens = (tokens: AuthTokens): void => {
  localStorage.setItem('access_token', tokens.access);
  localStorage.setItem('refresh_token', tokens.refresh);
};

const clearTokens = (): void => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

// Request interceptor - add auth header and handle Content-Type
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add impersonation header if admin is impersonating a user
    const impersonateId = localStorage.getItem('impersonate_user_id');
    if (impersonateId && config.headers) {
      config.headers['X-Impersonate-User'] = impersonateId;
    }

    // Set Content-Type based on data type
    // Don't set Content-Type for FormData - let axios handle it with boundary
    if (config.data && !(config.data instanceof FormData)) {
      config.headers = config.headers || {};
      config.headers['Content-Type'] = 'application/json';
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          const response = await axios.post<AuthTokens>(`${API_BASE_URL}/auth/refresh/`, {
            refresh: refreshToken,
          });

          setTokens(response.data);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
          }

          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          clearTokens();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }

    // 402 — Insufficient Diamond Tokens
    if (error.response?.status === 402 && error.response?.data?.code === 'INSUFFICIENT_DIAMONDS') {
      const { diamond_cost, diamond_balance, feature } = error.response.data;
      window.dispatchEvent(
        new CustomEvent('insufficient-diamonds', {
          detail: { cost: diamond_cost, balance: diamond_balance, feature },
        })
      );
    }

    return Promise.reject(error);
  }
);

/**
 * A fetch() wrapper that automatically adds Authorization and
 * X-Impersonate-User headers. Use this instead of native fetch()
 * for authenticated API calls.
 */
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  const impersonateId = localStorage.getItem('impersonate_user_id');

  const headers: Record<string, string> = {};

  // Copy existing headers
  if (options.headers) {
    Object.assign(headers, options.headers as Record<string, string>);
  }

  // Add auth header if not already set
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Add impersonation header
  if (impersonateId) {
    headers['X-Impersonate-User'] = impersonateId;
  }

  return fetch(url, { ...options, headers });
}

export { getAccessToken, getRefreshToken, setTokens, clearTokens };
export default api;
