import type { AxiosError } from 'axios';

export interface ExtractedError {
  message: string;
  field?: string;
  fields?: Record<string, string[]>;
  statusCode?: number;
  code?: string;
  isNetworkError: boolean;
  isServerError: boolean;
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Please check your input and try again.',
  401: 'Your session has expired. Please log in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'This action conflicts with the current state. Please refresh and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on our end. Please try again later.',
  502: 'Service temporarily unavailable. Please try again in a moment.',
  503: 'Service is under maintenance. Please try again later.',
};

export function extractApiError(error: unknown): ExtractedError {
  // Network error (no response from server)
  if (error && typeof error === 'object' && 'code' in error) {
    const axiosErr = error as AxiosError;
    if (axiosErr.code === 'ERR_NETWORK' || !axiosErr.response) {
      return {
        message: 'Network error. Please check your connection and try again.',
        isNetworkError: true,
        isServerError: false,
      };
    }
    if (axiosErr.code === 'ECONNABORTED') {
      return {
        message: 'Request timed out. Please try again.',
        isNetworkError: true,
        isServerError: false,
      };
    }
  }

  // Axios error with response
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as AxiosError<Record<string, unknown>>;
    const status = axiosError.response?.status;
    const data = axiosError.response?.data;
    const result: ExtractedError = {
      message: '',
      statusCode: status,
      isNetworkError: false,
      isServerError: (status ?? 0) >= 500,
    };

    if (data) {
      // 1) Direct 'error' string → {'error': 'message'}
      if (typeof data.error === 'string') {
        result.message = data.error;
        if (typeof data.code === 'string') result.code = data.code;
        return result;
      }

      // 2) DRF 'detail' string → {'detail': 'message'}
      if (typeof data.detail === 'string') {
        result.message = data.detail;
        return result;
      }

      // 3) 'message' string → {'message': 'some text'}
      if (typeof data.message === 'string') {
        result.message = data.message;
        return result;
      }

      // 4) 'non_field_errors' → {'non_field_errors': ['...']}
      if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
        result.message = (data.non_field_errors as string[]).join('. ');
        return result;
      }

      // 5) DRF field validation errors → {'field': ['error1', 'error2']}
      const fieldErrors: Record<string, string[]> = {};
      const parts: string[] = [];
      for (const [field, value] of Object.entries(data)) {
        if (Array.isArray(value) && value.length > 0) {
          fieldErrors[field] = value as string[];
          const label = field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          parts.push(`${label}: ${(value as string[]).join(', ')}`);
        } else if (typeof value === 'string' && field !== 'code') {
          fieldErrors[field] = [value];
          const label = field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          parts.push(`${label}: ${value}`);
        }
      }
      if (parts.length > 0) {
        result.message = parts.join('. ');
        result.fields = fieldErrors;
        result.field = Object.keys(fieldErrors)[0];
        return result;
      }
    }

    // Fallback to status-code-based message
    if (status && STATUS_MESSAGES[status]) {
      result.message = STATUS_MESSAGES[status];
      return result;
    }

    result.message = 'An unexpected error occurred. Please try again.';
    return result;
  }

  // Plain Error object
  if (error instanceof Error) {
    return {
      message: error.message || 'An unexpected error occurred.',
      isNetworkError: false,
      isServerError: false,
    };
  }

  return {
    message: 'An unexpected error occurred. Please try again.',
    isNetworkError: false,
    isServerError: false,
  };
}
