'use client';

import { FormEvent, useState } from 'react';
import { AxiosError } from 'axios';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { authApiService } from '@/services/auth.service';

function getErrorMessage(err: unknown, fallback: string): string {
  const axiosError = err as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? fallback;
}

function PasswordField({
  label,
  helpText,
  value,
  onChange,
  minLength,
}: Readonly<{
  label: string;
  helpText?: string;
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
}>) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <Input
      label={label}
      helpText={helpText}
      type={isVisible ? 'text' : 'password'}
      required
      minLength={minLength}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      trailingIcon={isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      onTrailingIconClick={() => setIsVisible((v) => !v)}
    />
  );
}

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới nhập lại không khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApiService.changePassword({
        oldPassword: currentPassword,
        newPassword: newPassword,
        confirmNewPassword: confirmPassword,
      });
      setSuccessMessage(res.message ?? 'Đổi mật khẩu thành công');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(getErrorMessage(err, 'Đổi mật khẩu thất bại, vui lòng thử lại.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md rounded-xl bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <KeyRound className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Đổi mật khẩu</h2>
          <p className="text-sm text-slate-500">Nhập mật khẩu hiện tại và mật khẩu mới.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <PasswordField label="Mật khẩu hiện tại" value={currentPassword} onChange={setCurrentPassword} />
        <PasswordField
          label="Mật khẩu mới"
          helpText="Tối thiểu 6 ký tự."
          minLength={6}
          value={newPassword}
          onChange={setNewPassword}
        />
        <PasswordField
          label="Nhập lại mật khẩu mới"
          minLength={6}
          value={confirmPassword}
          onChange={setConfirmPassword}
        />

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">
            {error}
          </p>
        )}
        {successMessage && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 ring-1 ring-inset ring-green-600/20">
            {successMessage}
          </p>
        )}

        <Button type="submit" isLoading={isSubmitting} className="w-fit">
          Đổi mật khẩu
        </Button>
      </form>
    </div>
  );
}

export default ChangePasswordForm;
