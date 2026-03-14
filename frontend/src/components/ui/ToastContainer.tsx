import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useToastStore } from '../../store/toastStore';
import type { ToastType } from '../../store/toastStore';

const toastConfig: Record<
  ToastType,
  {
    icon: typeof CheckCircleIcon;
    containerClass: string;
    iconClass: string;
  }
> = {
  success: {
    icon: CheckCircleIcon,
    containerClass: 'border-success/30 bg-success/10',
    iconClass: 'text-success',
  },
  error: {
    icon: XCircleIcon,
    containerClass: 'border-danger/30 bg-danger/10',
    iconClass: 'text-danger',
  },
  warning: {
    icon: ExclamationTriangleIcon,
    containerClass: 'border-warning/30 bg-warning/10',
    iconClass: 'text-warning',
  },
  info: {
    icon: InformationCircleIcon,
    containerClass: 'border-info/30 bg-info/10',
    iconClass: 'text-info',
  },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      className="fixed top-4 right-4 z-[200] flex flex-col gap-3 w-full max-w-sm pointer-events-none"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => {
          const config = toastConfig[t.type];
          const Icon = config.icon;

          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 80, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`
                pointer-events-auto
                flex items-start gap-3 p-4
                rounded-xl border backdrop-blur-sm
                shadow-lg shadow-black/20
                bg-dark-700/90 ${config.containerClass}
              `}
            >
              <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.iconClass}`} />
              <div className="flex-1 min-w-0">
                {t.title && (
                  <p className="text-sm font-semibold text-text-primary mb-0.5">{t.title}</p>
                )}
                <p className="text-sm text-text-secondary leading-relaxed">{t.message}</p>
              </div>
              {t.dismissible && (
                <button
                  onClick={() => removeToast(t.id)}
                  className="flex-shrink-0 p-0.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default ToastContainer;
