import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  DocumentIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { PlatformIcon, platformColors, platformNames } from './PlatformIcon';
import type { PostStatus, PlatformType } from '../../types';

type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-dark-500 text-text-secondary',
  primary: 'bg-primary/20 text-primary',
  secondary: 'bg-secondary/20 text-secondary',
  success: 'bg-success/20 text-success',
  warning: 'bg-warning/20 text-warning',
  danger: 'bg-danger/20 text-danger',
  info: 'bg-info/20 text-info',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'md', className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center gap-1.5 font-medium rounded-full',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// Status Badge for posts
interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: PostStatus;
}

const statusConfig: Record<PostStatus, { variant: BadgeVariant; label: string; Icon: typeof ClockIcon }> = {
  draft: { variant: 'default', label: 'Draft', Icon: DocumentIcon },
  pending_approval: { variant: 'warning', label: 'Pending Approval', Icon: ClockIcon },
  changes_requested: { variant: 'warning', label: 'Changes Requested', Icon: ExclamationCircleIcon },
  approved: { variant: 'success', label: 'Approved', Icon: CheckCircleIcon },
  rejected: { variant: 'danger', label: 'Rejected', Icon: XCircleIcon },
  scheduled: { variant: 'info', label: 'Scheduled', Icon: ClockIcon },
  posting: { variant: 'warning', label: 'Posting', Icon: ArrowPathIcon },
  posted: { variant: 'success', label: 'Posted', Icon: CheckCircleIcon },
  failed: { variant: 'danger', label: 'Failed', Icon: XCircleIcon },
  cancelled: { variant: 'default', label: 'Cancelled', Icon: ExclamationCircleIcon },
};

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, size = 'md', className, ...props }, ref) => {
    const config = statusConfig[status];
    const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5';

    return (
      <Badge ref={ref} variant={config.variant} size={size} className={className} {...props}>
        <config.Icon className={clsx(iconSize, status === 'posting' && 'animate-spin')} />
        {config.label}
      </Badge>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

// Platform Badge
interface PlatformBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  platform: PlatformType;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const PlatformBadge = forwardRef<HTMLSpanElement, PlatformBadgeProps>(
  ({ platform, showLabel = true, size = 'md', className, ...props }, ref) => {
    const colors = platformColors[platform];
    const name = platformNames[platform];

    const sizeClasses = {
      sm: 'px-2 py-0.5 text-[10px] gap-1',
      md: 'px-2.5 py-1 text-xs gap-1.5',
      lg: 'px-3 py-1.5 text-sm gap-2',
    };

    const iconSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md';

    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center font-medium rounded-full',
          `bg-gradient-to-r ${colors.gradient} bg-opacity-20`,
          colors.text,
          sizeClasses[size],
          className
        )}
        style={{
          background: `linear-gradient(135deg, ${colors.bg.replace('bg-[', '').replace(']', '')}20, ${colors.bg.replace('bg-[', '').replace(']', '')}10)`,
        }}
        {...props}
      >
        <PlatformIcon platform={platform} size={iconSize} className={colors.text} />
        {showLabel && <span className={colors.text}>{name}</span>}
      </span>
    );
  }
);

PlatformBadge.displayName = 'PlatformBadge';

export default Badge;
