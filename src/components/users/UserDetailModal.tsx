'use client';

import { ReactNode, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { formatDate } from '@/utils/formatDate';
import { USER_ROLE_OPTIONS } from '@/constants/roles';
import { userApiService } from '@/services/user.service';
import type { AdminUser } from '@/types/user';

interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUser | null;
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Đã vô hiệu hóa',
  SUSPENDED: 'Tạm khóa',
};

function InfoField({ label, value }: Readonly<{ label: string; value: ReactNode }>) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

export function UserDetailModal({ isOpen, onClose, user }: Readonly<UserDetailModalProps>) {
  const [fullUser, setFullUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user?.userId) {
      setIsLoading(true);
      userApiService.getUserById(user.userId)
        .then((res) => {
          if (res.success && res.data) {
            setFullUser(res.data);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    } else {
      setFullUser(null);
    }
  }, [isOpen, user]);

  if (!user) return null;

  const displayUser = fullUser || user;
  const roleLabel = USER_ROLE_OPTIONS.find((r) => r.value === displayUser.role)?.label ?? displayUser.role;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết người dùng" size="lg">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
          <Avatar name={displayUser.fullName} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-slate-900">{displayUser.fullName}</p>
              <Badge variant={getStatusBadgeVariant(displayUser.status)}>{STATUS_LABEL[displayUser.status] ?? displayUser.status}</Badge>
            </div>
            <p className="text-sm text-slate-500">@{displayUser.username}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-xl border border-slate-100 p-4">
          <InfoField label="Họ và tên" value={displayUser.fullName} />
          <InfoField label="Tên đăng nhập" value={displayUser.username} />
          <InfoField label="Vai trò" value={<Badge variant="neutral">{roleLabel}</Badge>} />
          <InfoField 
            label="Số điện thoại" 
            value={isLoading ? <span className="italic text-slate-400">Đang tải...</span> : (displayUser.phone || <span className="italic text-slate-400">Chưa cập nhật</span>)} 
          />
          <InfoField 
            label="Email" 
            value={isLoading ? <span className="italic text-slate-400">Đang tải...</span> : (displayUser.email || <span className="italic text-slate-400">Chưa cập nhật</span>)} 
          />
          <InfoField 
            label="Ngày tạo" 
            value={isLoading ? <span className="italic text-slate-400">Đang tải...</span> : (displayUser.createdAt ? formatDate(displayUser.createdAt) : <span className="italic text-slate-400">Chưa cập nhật</span>)} 
          />
        </div>
      </div>
    </Modal>
  );
}

export default UserDetailModal;
