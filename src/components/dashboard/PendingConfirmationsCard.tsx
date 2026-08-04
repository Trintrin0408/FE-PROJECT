import Link from 'next/link';
import { AlertCircle, CheckCircle2, ChevronRight, ClipboardEdit, DollarSign, MapPin, type LucideIcon } from 'lucide-react';
import type { ConfirmationType, PendingConfirmation } from '@/types/dashboard';

interface PendingConfirmationsCardProps {
  items: PendingConfirmation[];
}

const TYPE_ICON: Record<ConfirmationType, LucideIcon> = {
  survey: MapPin,
  change_request: ClipboardEdit,
  inventory_return: AlertCircle,
  deposit: DollarSign,
};

// Khối "hàng đợi chờ xác nhận" — đặc thù UX của Manager: phần lớn biên bản/chứng từ hiện trường do
// Leader Staff (mobile) ghi nhận trước, Manager chỉ xác nhận trên web (mục 1 CLAUDE.md).
export default function PendingConfirmationsCard({ items }: Readonly<PendingConfirmationsCardProps>) {
  const totalCount = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="flex h-full flex-col rounded-xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Hàng đợi chờ xác nhận</h3>
        {totalCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[11px] font-bold text-amber-700">
            {totalCount}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          <p className="text-xs text-slate-400">Không có mục nào chờ xác nhận.</p>
        </div>
      ) : (
        <div className="mt-3 flex-1 space-y-1">
          {items.map((item) => {
            const Icon = TYPE_ICON[item.type];
            return (
              <Link
                key={item.type}
                href={item.href}
                className="flex items-center gap-3 rounded-lg p-2 transition-colors duration-150 hover:bg-slate-50"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{item.label}</p>
                  <p className="truncate text-xs text-slate-400">{item.description}</p>
                </div>
                <span className="flex h-6 min-w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-bold text-slate-700">
                  {item.count}
                </span>
                <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
