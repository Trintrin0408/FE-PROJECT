'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  Package,
  FileText,
  BarChart3,
  Users,
  IdCard,
  ShoppingBag,
  MapPin,
  Calendar,
  CalendarCheck,
  Truck,
  HardHat,
  Store,
  Warehouse,
  Building2,
  FileSignature,
  FileCheck2,
  ClipboardList,
  RotateCcw,
  CreditCard,
  Wallet,
  Activity,
  TrendingUp,
  AlertTriangle,
  Boxes,
  Wrench,
  Shield,
  History,
  Settings,
  ChevronDown,
  ChevronLeft,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  badge?: number;
  badgeColor?: 'amber' | 'red';
  children?: NavItem[];
}

interface NavSection {
  /** Tiêu đề nhóm (vd "QUẢN LÝ VẬN HÀNH") — bỏ trống để hiển thị mục ở ngoài, không thuộc nhóm nào. */
  title?: string;
  items: NavItem[];
}

const ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    title: 'TỔNG QUAN',
    items: [
      { label: 'Bảng điều khiển', href: '/admin/dashboard', icon: LayoutGrid }
  ],
  },
  {
    title: 'QUẢN LÝ NGƯỜI DÙNG',
    items: [
      { label: 'Danh sách người dùng', href: '/admin/settings/users', icon: Users },
    ],
  },
  {
    title: 'THIẾT BỊ & TỒN KHO',
    items: [
      {
        label: 'Danh mục & Thiết bị',
        href: '/admin/catalog',
        icon: Package,
        children: [
          { label: 'Danh mục lớn', href: '/admin/catalog/categories' },
          { label: 'Nhóm thiết bị', href: '/admin/catalog/types' },
          { label: 'Danh sách thiết bị', href: '/admin/catalog' },
          { label: 'Tồn kho', href: '/admin/inventory/stock-status' },
        ],
      },
    ],
  },
  {
    title: 'ĐỐI TÁC',
    items: [
      {
        label: 'Nhà cung cấp',
        href: '/admin/suppliers',
        icon: Truck,
        children: [
          { label: 'Danh sách nhà cung cấp', href: '/admin/suppliers', icon: Building2 },
          { label: 'Đơn thuê/mua', href: '/admin/suppliers/purchase-orders', icon: FileSignature },
          { label: 'Trả thiết bị NCC', href: '/admin/suppliers/returns', icon: RotateCcw },
        ],
      },
    ],
  },
  {
    title: 'CHÍNH SÁCH NGHIỆP VỤ',
    items: [{ label: 'Chính sách', href: '/admin/policies', icon: Shield }],
  },
  {
    title: 'CÔNG VIỆC',
    items: [
      { label: 'Công việc', href: '/admin/work-tasks', icon: ClipboardList },
      { label: 'Chấm công', href: '/admin/schedule/attendances', icon: CalendarCheck },
    ],
  },
  {
    title: 'BÁO CÁO & KIỂM TOÁN',
    items: [
      // { label: 'Báo cáo doanh thu', href: '/admin/reports/revenue', icon: TrendingUp },
      // { label: 'Thống kê đơn hàng', href: '/admin/reports/orders', icon: BarChart3 },
      // { label: 'Báo cáo tồn kho', href: '/admin/reports/inventory', icon: Boxes },
      // { label: 'Nhật ký hệ thống', href: '/admin/settings/audit-log', icon: History },
    ],
  },
];

const MANAGER_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Tổng quan', href: '/manager/dashboard', icon: LayoutGrid },
      { label: 'Khách hàng', href: '/manager/customers', icon: Users },
      {
        label: 'Quản lý đơn đặt',
        href: '/manager/orders',
        icon: ShoppingBag,
        children: [
          { label: 'Danh sách đơn đặt', href: '/manager/orders', icon: ClipboardList, badge: 5, badgeColor: 'red' },
          { label: 'Báo giá', href: '/manager/quotations', icon: FileText },
          { label: 'Đặt cọc', href: '/manager/payments/deposits', icon: CreditCard },
          { label: 'Thanh toán', href: '/manager/payments/settlements', icon: Wallet },
        ],
      },
      { label: 'Báo cáo khảo sát', href: '/manager/survey', icon: MapPin },
      { label: 'Lịch trình', href: '/manager/schedule/plans', icon: Calendar },
      {
        label: 'Tồn kho',
        href: '/manager/inventory/stock-check',
        icon: Package,
        children: [
          { label: 'Tồn kho doanh nghiệp', href: '/manager/inventory/stock-check', icon: Warehouse },
          { label: 'Xuất kho và bàn giao', href: '/manager/inventory/picklists', icon: ClipboardList },
          { label: 'Thu hồi & hoàn kho', href: '/manager/inventory/returns', icon: RotateCcw },
        ],
      },
      {
        label: 'Nhà cung cấp',
        href: '/manager/suppliers',
        icon: Truck,
        children: [
          { label: 'Danh sách nhà cung cấp', href: '/manager/suppliers', icon: Building2 },
          { label: 'Đơn thuê/mua', href: '/manager/suppliers/purchase-orders', icon: FileSignature },
          { label: 'Trả thiết bị NCC', href: '/manager/suppliers/returns', icon: RotateCcw },
        ],
      },
      // {
      //   label: 'Hiện trường',
      //   href: '/manager/field-ops/handovers',
      //   icon: HardHat,
      //   children: [
      //     { label: 'Nghiệm thu & bàn giao', href: '/manager/field-ops/handovers', icon: FileCheck2 },
      //     { label: 'Vận chuyển & thi công', href: '/manager/field-ops/progress', icon: Activity },
      //     { label: 'Change Request', href: '/manager/field-ops/change-requests', icon: AlertTriangle },
      //   ],
      // },
      // { label: 'Công & lương', href: '/manager/wages', icon: Wallet },
    ],
  },
];

const BADGE_CLASSES: Record<'amber' | 'red', string> = {
  amber: 'bg-amber-500/15 text-amber-400',
  red: 'bg-rose-500/15 text-rose-400',
};

function findActiveHref(sections: NavSection[], pathname: string | null): string | null {
  if (!pathname) return null;
  let bestMatch: string | null = null;
  let maxLen = 0;

  const traverse = (items: NavItem[]) => {
    for (const item of items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        if (item.href.length > maxLen) {
          maxLen = item.href.length;
          bestMatch = item.href;
        }
      }
      if (item.children) {
        traverse(item.children);
      }
    }
  };

  for (const section of sections) {
    traverse(section.items);
  }
  
  return bestMatch;
}

/** Thu thập nhãn của MỌI nhóm cha (đệ quy) — dùng để mặc định mở sẵn tất cả, khớp ảnh thiết kế. */
function collectAllGroupLabels(items: NavItem[], acc: Set<string>): void {
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      acc.add(item.label);
      collectAllGroupLabels(item.children, acc);
    }
  }
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = user?.role.roleName === 'Admin';
  const sections = isAdmin ? ADMIN_NAV_SECTIONS : MANAGER_NAV_SECTIONS;
  const basePath = isAdmin ? '/admin' : '/manager';

  const activeHref = findActiveHref(sections, pathname);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedLabels, setExpandedLabels] = useState<Set<string>>(() => {
    // Mặc định mở sẵn mọi nhóm cha (khớp ảnh thiết kế) — thu gọn khi người dùng bấm chevron.
    const all = new Set<string>();
    for (const section of sections) collectAllGroupLabels(section.items, all);
    return all;
  });

  const toggleLabel = (label: string) => {
    setExpandedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  const renderItem = (item: NavItem, depth: number): React.ReactNode => {
    const isActive = item.href === activeHref;
    const Icon = item.icon;
    const hasChildren = Boolean(item.children && item.children.length > 0);
    const isExpanded = expandedLabels.has(item.label);
    const paddingLeft = depth === 0 ? 'px-3' : depth === 1 ? 'pl-9 pr-3' : 'pl-12 pr-3';

    if (hasChildren) {
      const hasActiveChild = (function checkActive(children: NavItem[]): boolean {
        return children.some(c => c.href === activeHref || (c.children ? checkActive(c.children) : false));
      })(item.children!);

      return (
        <div key={item.label}>
          <button
            type="button"
            onClick={() => toggleLabel(item.label)}
            className={`flex w-full items-center gap-3 rounded-lg py-2 text-[13px] font-medium transition-colors duration-150 ${paddingLeft} ${
              hasActiveChild ? 'text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
            {!isCollapsed && <span className="flex-1 text-left">{item.label}</span>}
            {!isCollapsed && (
              <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} />
            )}
          </button>
          {!isCollapsed && isExpanded && (
            <div className="mt-0.5 space-y-0.5">{item.children!.map((child) => renderItem(child, depth + 1))}</div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 rounded-lg py-2 text-[13px] font-medium transition-colors duration-150 ${paddingLeft} ${
          isActive ? 'border-l-2 border-blue-500 bg-slate-800/60 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
      >
        {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
        {!isCollapsed && <span className="flex-1">{item.label}</span>}
        {!isCollapsed && typeof item.badge === 'number' && item.badge > 0 && (
          <span
            className={`flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${BADGE_CLASSES[item.badgeColor ?? 'red']}`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={`flex h-screen flex-shrink-0 flex-col border-r border-slate-800 bg-[#111827] text-slate-300 transition-all duration-200 ${
        isCollapsed ? 'w-[76px]' : 'w-[260px]'
      }`}
    >
      <div className="flex items-center gap-3 border-b border-slate-800 p-6">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600/15 text-sm font-bold text-blue-400 ring-1 ring-inset ring-blue-500/30">
          BN
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-white">BNWEMS</p>
            <p className="truncate text-xs leading-tight text-slate-500">Phần mềm quản lý</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {sections.map((section, sectionIndex) => (
          <div key={section.title ?? `section-${sectionIndex}`} className="space-y-1">
            {section.title && !isCollapsed && (
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{section.title}</p>
            )}
            {section.items.map((item) => renderItem(item, 0))}
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <Link href={`${basePath}/profile`} className="group flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-700 text-xs font-medium text-white transition-colors duration-150 group-hover:border-blue-500">
              {user?.fullName?.charAt(0) ?? '?'}
            </div>
            {!isCollapsed && (
              <p className="truncate text-xs font-medium text-white transition-colors duration-150 group-hover:text-blue-400">
                {user?.fullName ?? 'Người dùng'}
              </p>
            )}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-800 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium text-slate-400 transition-colors duration-150 hover:bg-slate-800 hover:text-white"
        >
          <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} />
          {!isCollapsed && 'Thu gọn'}
        </button>
      </div>
    </aside>
  );
}
