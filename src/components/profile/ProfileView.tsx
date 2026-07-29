'use client';

import { useState } from 'react';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import Reveal from '@/components/ui/Reveal';
import { formatDate } from '@/utils/formatDate';
import type { AuthProfile } from '@/types/auth';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { authApiService } from '@/services/auth.service';

interface ProfileViewProps {
  infoHref: string;
  securityHref: string;
}

export function ProfileView({ infoHref, securityHref }: Readonly<ProfileViewProps>) {
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    email: '',
  });
  const [editError, setEditError] = useState('');

  const handleOpenEdit = () => {
    if (profile) {
      setEditForm({
        fullName: profile.fullName || '',
        phone: profile.phone || '',
        email: profile.email || '',
      });
      setEditError('');
      setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    try {
      setIsSubmitting(true);
      setEditError('');
      await authApiService.updateProfile(editForm);
      // Reload page to reflect changes globally
      window.location.reload();
    } catch (err: any) {
      setEditError(err?.response?.data?.message || 'Cập nhật thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Hồ sơ cá nhân</h1>
        <p className="mt-1 text-sm text-slate-500">Xem và cập nhật thông tin tài khoản của bạn.</p>
      </div>

      <div className="mt-6">
        <ProfileHeader activeTab="info" infoHref={infoHref} securityHref={securityHref} onProfileLoaded={setProfile} />
      </div>

      <Reveal className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Thông tin cơ bản</h3>
          {profile && (
            <Button variant="secondary" size="sm" onClick={handleOpenEdit}>
              Sửa hồ sơ
            </Button>
          )}
        </div>
        
        {profile ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Mã người dùng</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{profile.userId}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Tên đăng nhập</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{profile.username}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Email liên hệ</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{profile.email || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Số điện thoại</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{profile.phone || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Ngày tạo</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{formatDate(profile.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Cập nhật gần nhất</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{formatDate(profile.updatedAt)}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        )}
      </Reveal>

      <Modal 
        isOpen={isEditing} 
        onClose={() => !isSubmitting && setIsEditing(false)} 
        title="Sửa hồ sơ cá nhân"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleSaveEdit} isLoading={isSubmitting}>
              Lưu thay đổi
            </Button>
          </>
        }
      >
        <div className="space-y-4 pt-2">
          {editError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {editError}
            </div>
          )}
          <Input 
            label="Họ và tên" 
            value={editForm.fullName} 
            onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
            disabled={isSubmitting}
          />
          <Input 
            label="Số điện thoại" 
            value={editForm.phone} 
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            disabled={isSubmitting}
          />
          <Input 
            label="Email liên hệ" 
            type="email"
            value={editForm.email} 
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            disabled={isSubmitting}
          />
        </div>
      </Modal>
    </div>
  );
}

export default ProfileView;
