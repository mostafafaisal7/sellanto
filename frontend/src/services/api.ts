import axios from 'axios';
import type { AuthTokens } from '../types';
import { extractApiError } from '../utils/extractApiError';
import { toast } from '../store/toastStore';

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

const getCsrfToken = (): string | null => {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
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

    // Attach Django CSRF token for all mutating requests
    const method = (config.method || '').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken && config.headers) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
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

// Auth endpoints should never trigger the refresh-token dance.
// A 401 from /auth/login/ means "wrong password" — the user must see that error,
// not get hard-redirected to /login because a stale refresh token failed to refresh.
const AUTH_ENDPOINTS = ['/auth/login/', '/auth/register/', '/auth/refresh/'];
const isAuthEndpoint = (url?: string): boolean =>
  !!url && AUTH_ENDPOINTS.some((path) => url.includes(path));

// Single in-flight refresh promise. The backend has BLACKLIST_AFTER_ROTATION=True
// (settings.py SIMPLE_JWT), so if N concurrent requests each hit /auth/refresh/
// with the same refresh token, the first wins and blacklists it — the rest fail
// and force a logout. We must serialize: only one refresh runs at a time, and all
// other 401s wait for its result before retrying.
let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = (): Promise<string> => {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return Promise.reject(new Error('No refresh token'));
  }

  refreshPromise = axios
    .post<AuthTokens>(`${API_BASE_URL}/auth/refresh/`, { refresh: refreshToken })
    .then((response) => {
      setTokens(response.data);
      return response.data.access;
    })
    .finally(() => {
      // Release the lock so the next expiry cycle can refresh again.
      refreshPromise = null;
    });

  return refreshPromise;
};

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't tried to refresh yet (and it's not an auth endpoint)
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url)
    ) {
      originalRequest._retry = true;

      if (getRefreshToken()) {
        try {
          const newAccess = await refreshAccessToken();

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccess}`;
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

    // 402 — Insufficient Diamond Tokens (has its own modal, skip auto-toast)
    if (error.response?.status === 402 && error.response?.data?.code === 'INSUFFICIENT_DIAMONDS') {
      const { diamond_cost, diamond_balance, feature } = error.response.data;
      window.dispatchEvent(
        new CustomEvent('insufficient-diamonds', {
          detail: { cost: diamond_cost, balance: diamond_balance, feature },
        })
      );
      return Promise.reject(error);
    }

    // Auto-toast for all other errors
    const silentError = error.config?._silentError === true;
    const extracted = extractApiError(error);

    // Attach extracted message for callers that want it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).userMessage = extracted.message;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).extractedError = extracted;

    // Show toast unless caller opted out or it's a 401 (handled by redirect)
    if (!silentError && error.response?.status !== 401) {
      toast.error(extracted.message);
    }

    return Promise.reject(error);
  }
);

/**
 * A fetch() wrapper that automatically adds Authorization and
 * X-Impersonate-User headers. Use this instead of native fetch()
 * for authenticated API calls.
 *
 * On a 401 it refreshes the access token and retries once, mirroring the axios
 * interceptor above. Without this, an expired access token (they last 60
 * minutes) simply returned a failed Response that callers read as "no data" —
 * e.g. the Connect Accounts page kept rendering the pre-connect state after a
 * successful OAuth, and only a full page reload fixed it, because the reload
 * minted a fresh token. It shares refreshAccessToken()'s single-flight promise,
 * so concurrent 401s cannot each burn the (rotating, blacklist-on-use) refresh
 * token.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const impersonateId = localStorage.getItem('impersonate_user_id');

  const buildHeaders = (
    token: string | null,
    source: HeadersInit | undefined = options.headers,
  ): Record<string, string> => {
    const headers: Record<string, string> = {};

    // Copy existing headers
    if (source) {
      Object.assign(headers, source as Record<string, string>);
    }

    // Add auth header if not already set
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add impersonation header
    if (impersonateId) {
      headers['X-Impersonate-User'] = impersonateId;
    }

    return headers;
  };

  const staleToken = getAccessToken();
  const response = await fetch(url, { ...options, headers: buildHeaders(staleToken) });

  if (response.status !== 401 || isAuthEndpoint(url) || !getRefreshToken()) {
    return response;
  }

  // Callers commonly pass an explicit Authorization header built from the same
  // stored token (ConnectAccountsPage does), so a caller-supplied header is NOT
  // a reason to skip the retry — it is the very token that just expired. Drop it
  // so buildHeaders re-applies the refreshed one.
  const retryOptions: RequestInit = { ...options };
  if (options.headers) {
    const { Authorization: _drop, ...rest } = options.headers as Record<string, string>;
    retryOptions.headers = rest;
  }

  try {
    const newAccess = await refreshAccessToken();
    return await fetch(url, {
      ...retryOptions,
      headers: buildHeaders(newAccess, retryOptions.headers),
    });
  } catch {
    // Refresh failed — hand back the original 401 and let the axios layer's
    // redirect handle the logout, rather than racing it from here.
    return response;
  }
}

export { getAccessToken, getRefreshToken, setTokens, clearTokens };
export default api;
