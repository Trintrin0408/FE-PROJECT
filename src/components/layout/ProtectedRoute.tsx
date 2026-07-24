'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_DASHBOARD_PATH } from '@/constants/roles';

interface ProtectedRouteProps {
  requiredRole?: string | string[];
  children: ReactNode;
}

export default function ProtectedRoute({ requiredRole, children }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const allowedRoles = requiredRole === undefined ? undefined : Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const isRoleMismatch = Boolean(allowedRoles) && !allowedRoles!.includes(user?.role.roleName ?? '');

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/auth/login');
      return;
    }
    if (isRoleMismatch) {
      router.replace(ROLE_DASHBOARD_PATH[user?.role.roleName ?? ''] ?? '/auth/login');
    }
  }, [isLoading, isAuthenticated, isRoleMismatch, user, router]);

  if (isLoading || !isAuthenticated || isRoleMismatch) {
    return <div className="flex h-screen items-center justify-center text-slate-400">Đang tải...</div>;
  }

  return <>{children}</>;
}
