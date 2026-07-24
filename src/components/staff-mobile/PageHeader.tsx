'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  right?: ReactNode;
}

/** Header đầu trang dùng cho các màn hình con của staff-mobile (Công việc, Lịch, Chấm công, Cá
 * nhân...) — nhất quán chiều cao/khoảng cách với Header.tsx phía desktop nhưng đơn giản hơn, tối ưu
 * cho màn hình hẹp. Trang chủ có header riêng (lời chào + avatar), không dùng component này. */
export default function PageHeader({ title, subtitle, backHref, right }: Readonly<PageHeaderProps>) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-100 bg-white px-4 py-3.5">
      {backHref && (
        <Link
          href={backHref}
          aria-label="Quay lại"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-50"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
