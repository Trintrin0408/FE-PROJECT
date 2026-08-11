'use client';

// Bảng công nợ theo thời gian: đơn đang treo tiền, xếp theo mức gấp (quá hạn → cần theo dõi). Cho manager
// thấy ngay đơn nào "chưa thu cọc mà sắp tới ngày" hoặc "đã qua sự kiện mà chưa quyết toán".

import Link from 'next/link';
import { AlertCircle, Clock, CalendarClock, Eye } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import { formatDate } from '@/utils/formatDate';
import { formatCurrency } from '@/utils/formatCurrency';
import type { AgingLevel, AgingRow } from '@/hooks/usePaymentAging';

const LEVEL_META: Record<AgingLevel, { label: string; badge: string; border: string; row: string }> = {
  overdue: { label: 'Quá hạn', badge: 'bg-rose-100 text-rose-700', border: 'border-rose-400', row: 'bg-rose-50/40' },
  urgent: { label: 'Gấp', badge: 'bg-orange-100 text-orange-700', border: 'border-orange-400', row: 'bg-orange-50/30' },
  'due-soon': { label: 'Sắp đến hạn', badge: 'bg-amber-100 text-amber-700', border: 'border-amber-300', row: '' },
  watch: { label: 'Theo dõi', badge: 'bg-slate-100 text-slate-600', border: 'border-transparent', row: '' },
};

const PAYMENT_LABEL: Record<string, string> = { UNPAID: 'Chưa cọc', DEPOSITED: 'Đã cọc', PAID: 'Đã thanh toán' };

function daysText(daysLeft: number): string {
  if (daysLeft < 0) return `Đã qua ${-daysLeft} ngày`;
  if (daysLeft === 0) return 'Hôm nay';
  return `Còn ${daysLeft} ngày`;
}

export default function PaymentAgingBoard({ rows, isLoading }: { rows: AgingRow[]; isLoading?: boolean }) {
  return (
    <Reveal className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
          <AlertCircle className="h-4 w-4 text-rose-500" /> Công nợ theo thời gian
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">Đơn đang treo tiền, xếp theo mức gấp so với ngày sự kiện — quá hạn ở trên cùng.</p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2">Đơn / Khách hàng</th>
              <th className="px-2 py-2"><span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Ngày sự kiện</span></th>
              <th className="px-2 py-2">Thanh toán</th>
              <th className="px-2 py-2 text-right">Giá trị</th>
              <th className="px-2 py-2">Cảnh báo</th>
              <th className="px-2 py-2 text-center">Xem</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-2 py-10 text-center text-sm text-slate-400">Đang tải…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-2 py-10 text-center text-sm text-emerald-600">Không có công nợ nào đang treo — mọi đơn đã thanh toán đủ. 🎉</td></tr>
            )}
            {rows.map((r) => {
              const m = LEVEL_META[r.level];
              return (
                <tr key={r.orderId} className={`border-b border-slate-50 transition hover:bg-slate-50/70 ${m.row}`}>
                  <td className={`px-2 py-3 border-l-2 ${m.border}`}>
                    <Link href={`/manager/orders/${r.orderId}`} className="font-semibold text-blue-700 hover:underline">{r.orderCode}</Link>
                    <div className="text-xs text-slate-500">{r.customerName}</div>
                    <div className="text-[11px] text-slate-400">{r.eventName || '—'}</div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="text-slate-700">{formatDate(r.eventDate)}</div>
                    <div className={`text-[11px] ${r.daysLeft < 0 ? 'text-rose-500' : r.daysLeft <= 7 ? 'text-orange-500' : 'text-slate-400'}`}>{daysText(r.daysLeft)}</div>
                  </td>
                  <td className="px-2 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${r.paymentStatus === 'DEPOSITED' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {PAYMENT_LABEL[r.paymentStatus] ?? r.paymentStatus}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right font-semibold text-slate-800">{formatCurrency(r.totalAmount)}</td>
                  <td className="px-2 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${m.badge}`}>
                      <Clock className="h-3 w-3" /> {m.label}
                    </span>
                    <div className="mt-0.5 text-[11px] text-slate-500">{r.reason}</div>
                  </td>
                  <td className="px-2 py-3 text-center">
                    <Link
                      href={r.paymentStatus === 'DEPOSITED' ? `/manager/payments/settlements` : `/manager/payments/deposits`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
                      title="Xử lý thanh toán"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Reveal>
  );
}
