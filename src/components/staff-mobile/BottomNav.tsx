'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListChecks, CalendarDays, ClipboardCheck, UserRound } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/staff-mobile/dashboard', label: 'Trang chủ', icon: Home },
  { href: '/staff-mobile/tasks', label: 'Công việc', icon: ListChecks },
  { href: '/staff-mobile/schedule', label: 'Lịch', icon: CalendarDays },
  { href: '/staff-mobile/attendance', label: 'Chấm công', icon: ClipboardCheck },
  { href: '/staff-mobile/profile', label: 'Cá nhân', icon: UserRound },
];

/** Thanh điều hướng dưới cùng dùng chung cho toàn bộ app staff-mobile — 5 mục cố định cho cả Leader
 * lẫn Technical Staff (mục dành riêng Leader như "Ghi nhận hiện trường" mở từ Trang chủ, không chiếm
 * thêm chỗ ở đây để giữ thanh nav gọn trên màn hình nhỏ). */
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 flex border-t border-slate-100 bg-white pb-[env(safe-area-inset-bottom)]">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium"
          >
            <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} strokeWidth={isActive ? 2.4 : 2} />
            <span className={isActive ? 'text-blue-600' : 'text-slate-400'}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
