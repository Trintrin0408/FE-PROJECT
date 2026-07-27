'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_DASHBOARD_PATH } from '@/constants/roles';

interface ProtectedRouteProps {
  requiredRole?: string;
  children: ReactNode;
}

export default function ProtectedRoute({ requiredRole, children }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isRoleMismatch = Boolean(requiredRole) && user?.role.roleName !== requiredRole;

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/auth/login');
      return;
    }
    if (user?.mustChangePassword) {
      const basePath = user.role?.roleName === 'Admin' ? '/admin' : '/manager';
      const targetPath = `${basePath}/profile/change-password`;
      if (pathname !== targetPath) {
        router.replace(targetPath);
      }
      return;
    }
    if (isRoleMismatch) {
      router.replace(ROLE_DASHBOARD_PATH[user?.role.roleName ?? ''] ?? '/auth/login');
    }
  }, [isLoading, isAuthenticated, isRoleMismatch, user, router, pathname]);

  const isChangePasswordRoute =
    user?.mustChangePassword && pathname === `${user.role?.roleName === 'Admin' ? '/admin' : '/manager'}/profile/change-password`;

  if (isLoading || !isAuthenticated || isRoleMismatch || (user?.mustChangePassword && !isChangePasswordRoute)) {
    return <div className="flex h-screen items-center justify-center text-slate-400">Đang tải...</div>;
  }

  return <>{children}</>;
}
