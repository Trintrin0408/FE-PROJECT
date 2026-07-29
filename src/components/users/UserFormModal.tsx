'use client';

import { FormEvent, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { USER_ROLE_OPTIONS } from '@/constants/roles';
import type { AdminUser, UserRole, UserStatus } from '@/types/user';

export interface UserFormValues {
  username: string;
  password?: string;
  fullName: string;
  role: UserRole;
  email: string;
  phone: string;
  status: UserStatus;
}

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  user?: AdminUser | null;
  isSubmitting: boolean;
  errorMessage?: string;
  onSubmit: (values: UserFormValues) => void;
}

const EMPTY_VALUES: UserFormValues = {
  username: '',
  password: '',
  fullName: '',
  role: 'MANAGER',
  email: '',
  phone: '',
  status: 'ACTIVE',
};

export function UserFormModal({
  isOpen,
  onClose,
  mode,
  user,
  isSubmitting,
  errorMessage,
  onSubmit,
}: Readonly<UserFormModalProps>) {
  const [values, setValues] = useState<UserFormValues>(EMPTY_VALUES);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setValues(
        mode === 'edit' && user
          ? { 
              username: user.username, 
              password: '', 
              fullName: user.fullName, 
              role: user.role,
              email: (user as any).email ?? '',
              phone: (user as any).phone ?? '',
              status: user.status ?? 'ACTIVE'
            }
          : EMPTY_VALUES
      );
      setConfirmPassword('');
      setShowPassword(false);
    }
  }

  const passwordMismatch = mode === 'create' && confirmPassword.length > 0 && values.password !== confirmPassword;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === 'create' && values.password !== confirmPassword) return;
    onSubmit(values);
  };

  const footer = (
    <>
      <Button type="button" variant="secondary" onClick={onClose}>
        Hủy
      </Button>
      <Button type="submit" form="user-form" isLoading={isSubmitting}>
        {mode === 'create' ? 'Tạo người dùng' : 'Lưu thay đổi'}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Tạo người dùng mới' : 'Chỉnh sửa người dùng'}
      subtitle={mode === 'create' ? 'Thêm một tài khoản nhân sự mới và gán vai trò.' : `Cập nhật thông tin cho @${user?.username ?? ''}.`}
      size="lg"
      footer={footer}
    >
      <form id="user-form" onSubmit={handleSubmit} className="flex flex-col gap-4" autoComplete="off">
        <Input
          label="Họ và tên"
          required
          value={values.fullName}
          onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Tên đăng nhập"
            required
            disabled={mode === 'edit'}
            value={values.username}
            onChange={(e) => setValues((v) => ({ ...v, username: e.target.value }))}
            autoComplete="off"
          />
          <Select
            label="Vai trò"
            required
            value={values.role}
            onChange={(e) => setValues((v) => ({ ...v, role: e.target.value as UserRole }))}
            options={USER_ROLE_OPTIONS}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Số điện thoại"
            value={values.phone}
            onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
            pattern="^0[0-9]{9}$"
            title="Số điện thoại phải bắt đầu bằng số 0 và có đúng 10 chữ số"
          />
          <Input
            label="Email"
            required
            type="email"
            value={values.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
            autoComplete="off"
          />
        </div>

        {mode === 'create' && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Mật khẩu"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={values.password}
              onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
              trailingIcon={showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              onTrailingIconClick={() => setShowPassword((s) => !s)}
              autoComplete="new-password"
            />
            <Input
              label="Xác nhận mật khẩu"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              error={passwordMismatch ? 'Mật khẩu xác nhận không khớp' : undefined}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        )}

        {errorMessage && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">
            {errorMessage}
          </p>
        )}
      </form>
    </Modal>
  );
}

export default UserFormModal;
