import { ReceiptText } from 'lucide-react';
import AnalyticsCard from '@/components/dashboard/AnalyticsCard';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import type { OrderDetail } from '@/types/order';

interface EventOverviewCardProps {
  order: OrderDetail;
  quotationTotal: number | null;
  paymentCollected: number;
  paymentTotal: number;
}

export default function EventOverviewCard({
  order,
  quotationTotal,
  paymentCollected,
  paymentTotal,
}: Readonly<EventOverviewCardProps>) {
  const progressPercent = paymentTotal > 0 ? Math.min(100, Math.round((paymentCollected / paymentTotal) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-6 text-lg font-bold text-slate-900">Thông tin sự kiện</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">Địa điểm</p>
            <p className="text-sm font-semibold text-slate-900">{order.location}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">Ngày tổ chức</p>
            <p className="text-sm font-semibold text-slate-900">{formatDate(order.eventDate)}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">Ngày kết thúc</p>
            <p className="text-sm font-semibold text-slate-900">{order.endDate ? formatDate(order.endDate) : '—'}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">Ngày tạo đơn</p>
            <p className="text-sm font-semibold text-slate-900">{formatDate(order.createdAt)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase text-slate-400">Báo giá</p>
          <div className="flex items-end justify-between">
            <p className="text-lg font-bold text-slate-900">{quotationTotal != null ? formatCurrency(quotationTotal) : '—'}</p>
            <ReceiptText className="h-6 w-6 text-slate-300" />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase text-slate-400">Thanh toán</p>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900">
              {formatCurrency(paymentCollected)} / {formatCurrency(paymentTotal)}
            </p>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-blue-600" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <AnalyticsCard title="Nhân sự được phân công" isPlaceholder>
        <p className="text-sm text-slate-500">Chưa kết nối dữ liệu phân công nhân sự cho đơn hàng này.</p>
      </AnalyticsCard>
    </div>
  );
}
