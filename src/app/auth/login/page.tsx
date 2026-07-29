'use client';

import { useState, SubmitEvent } from 'react';
import { useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { authApiService } from '@/services/auth.service';
import { ROLE_DASHBOARD_PATH } from '@/constants/roles';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cố ý KHÔNG tự động điều hướng sang dashboard dù đã có phiên đăng nhập lưu sẵn trong localStorage
  // (khác quy ước thường thấy) — theo yêu cầu người dùng: trang này luôn phải hiện form đăng nhập mỗi
  // khi được mở, không tự nhảy thẳng vào Admin/Manager dashboard chỉ vì còn phiên cũ từ lần trước.
  // Việc chặn truy cập trang đã bảo vệ khi CHƯA đăng nhập vẫn do ProtectedRoute.tsx đảm nhiệm riêng.

  // Gọi thẳng backend thật (POST /api/v1/auth/login, D:\sep490-backend-api\src\modules\identity) —
  // xem docs/login_api.md mục 2.1/5 (đã đối chiếu DB thật, 4 route auth đang hoạt động đúng).
  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await authApiService.login({ username, password });
      const { token, user } = response.data;

      login(token, user);

      const dashboardPath = ROLE_DASHBOARD_PATH[user.role.roleName];
      if (!dashboardPath) {
        setError('Vai trò tài khoản không được hỗ trợ trên web.');
        return;
      }

      if (user.mustChangePassword) {
        const basePath = user.role.roleName === 'Admin' ? '/admin' : '/manager';
        router.replace(`${basePath}/profile/change-password`);
        return;
      }

      router.replace(dashboardPath);
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.error?.message : undefined;
      setError(message || 'Sai tên đăng nhập hoặc mật khẩu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      <div className="flex w-full flex-col px-6 py-8 sm:px-12 lg:w-[45%] lg:px-16 lg:py-12">
        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-base font-bold text-white">
                BN
              </div>
            </div>
            <h1 className="mt-4 text-center text-2xl font-semibold text-slate-900">Đăng nhập</h1>
            <p className="mt-1 text-center text-sm text-slate-500">Hệ thống quản lý Bình Nguyên</p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
              <Input
                icon={<UserIcon />}
                placeholder="Tên đăng nhập"
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
              <Input
                icon={<LockIcon />}
                type="password"
                placeholder="Mật khẩu"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Nhớ đăng nhập</span>
                </label>
                <a href="/auth/forgot-password" className="text-blue-600 hover:underline">
                  Quên mật khẩu?
                </a>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">
                  {error}
                </p>
              )}

              <Button type="submit" isLoading={isSubmitting} className="w-full mt-1">
                Đăng nhập
              </Button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400">© 2026 Bình Nguyên Wedding & Event</p>
      </div>

      <div className="relative hidden flex-1 overflow-hidden bg-blue-950 lg:flex">
        <div className="pointer-events-none absolute -top-20 -right-10 h-72 w-72 rounded-full bg-blue-300/30 blur-3xl" />

        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 800 1000"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1d4ed8" />
              <stop offset="35%" stopColor="#38bdf8" />
              <stop offset="65%" stopColor="#fda4af" />
              <stop offset="100%" stopColor="#fde68a" />
            </linearGradient>
          </defs>
          <path
            d="M 620 -80 C 760 140, 430 260, 560 480 C 690 700, 360 760, 480 1080"
            fill="none"
            stroke="url(#waveGradient)"
            strokeWidth="260"
            strokeLinecap="round"
            opacity="0.85"
            style={{ filter: 'blur(55px)' }}
          />
        </svg>

        <div className="relative z-10 flex h-full w-full flex-col p-12">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-blue-100 ring-1 ring-inset ring-white/20 backdrop-blur-sm">
            ✦ BNWEMS
          </span>

          <div className="flex-1" />

          <div className="ml-auto max-w-md pb-24 text-right">
            <div className="ml-auto h-1 w-12 rounded-full bg-gradient-to-r from-cyan-300 to-amber-200" />
            <h2 className="mt-5 text-[3.25rem] font-bold leading-[1.1] tracking-tight text-white sm:text-[3.75rem]">
              Chào mừng
              <br />
              trở lại.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-blue-100/90">
              Quản lý toàn bộ vòng đời đơn hàng tiệc cưới — từ khảo sát, báo giá đến quyết toán — trên một nền tảng
              duy nhất.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}
