import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const MAX_TOASTS = 5;
let toastCounter = 0;

function getDefaultDuration(type: ToastType): number {
  switch (type) {
    case 'success':
      return 3000;
    case 'info':
      return 4000;
    case 'warning':
      return 5000;
    case 'error':
      return 6000;
    default:
      return 4000;
  }
}

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    const newToast: Toast = {
      id,
      dismissible: true,
      ...toast,
    };

    set((state) => {
      const current = state.toasts;
      const updated =
        current.length >= MAX_TOASTS ? [...current.slice(1), newToast] : [...current, newToast];
      return { toasts: updated };
    });

    const duration = toast.duration ?? getDefaultDuration(toast.type);
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }

    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAll: () => set({ toasts: [] }),
}));

// Convenience API — callable from non-React code (e.g. axios interceptor)
export const toast = {
  success: (message: string, title?: string) =>
    useToastStore.getState().addToast({ type: 'success', message, title }),
  error: (message: string, title?: string) =>
    useToastStore.getState().addToast({ type: 'error', message, title }),
  warning: (message: string, title?: string) =>
    useToastStore.getState().addToast({ type: 'warning', message, title }),
  info: (message: string, title?: string) =>
    useToastStore.getState().addToast({ type: 'info', message, title }),
};

export default useToastStore;
