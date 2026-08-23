import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-700 ring-green-600/20',
  warning: 'bg-yellow-100 text-yellow-700 ring-yellow-600/20',
  error: 'bg-red-100 text-red-700 ring-red-600/20',
  info: 'bg-blue-100 text-blue-700 ring-blue-600/20',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-600/20',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children, className = '' }) => {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

/** Map order/user status strings to badge variant */
export const getStatusBadgeVariant = (status: string): BadgeVariant => {
  const mapping: Record<string, BadgeVariant> = {
    ACTIVE: 'success',
    CONFIRMED: 'success',
    APPROVED: 'success',
    COMPLETED: 'success',
    SUCCESS: 'success',
    PAID: 'success',
    RECORDED: 'warning',
    DRAFT: 'neutral',
    IN_PROGRESS: 'info',
    PENDING: 'warning',
    UNPAID: 'warning',
    OVERDUE: 'error',
    PENDING_SURVEY: 'warning',
    WAITING_FOR_DEPOSIT: 'warning',
    EXECUTING: 'info',
    INACTIVE: 'neutral',
    DEACTIVATED: 'error',
    CANCELLED: 'error',
    FAILED: 'error',
    SUSPENDED: 'warning',
    LOCKED: 'warning',
    MAINTENANCE: 'warning',
  };
  return mapping[status] || 'neutral';
};

export default Badge;
