'use client';

import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, MoreHorizontal } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { formatCurrency } from '@/utils/formatCurrency';
import { ORDER_STATUS_LABEL } from '@/constants/order-status';
import type { RecentOrderRow } from '@/types/dashboard';

interface RecentOrdersCardProps {
  orders: RecentOrderRow[];
  isLoading?: boolean;
}

export default function RecentOrdersCard({ orders, isLoading }: Readonly<RecentOrdersCardProps>) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter && order.status !== statusFilter) return false;
      if (!term) return true;
      return order.orderId.toLowerCase().includes(term) || order.customerName.toLowerCase().includes(term);
    });
  }, [orders, search, statusFilter]);

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Đơn đặt gần đây</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm đơn đặt, khách hàng..."
              className="w-56 rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 focus:border-blue-500 focus:outline-none"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(ORDER_STATUS_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Bộ lọc
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-3">Mã đơn</th>
              <th className="py-2 pr-3">Khách hàng</th>
              <th className="py-2 pr-3">Ngày tổ chức</th>
              <th className="py-2 pr-3">Giá trị</th>
              <th className="py-2 pr-3">Trạng thái</th>
              <th className="py-2 pr-3">Phụ trách</th>
              <th className="py-2 pr-0 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((order) => {
              return (
                <tr key={order.orderId}>
                  <td className="py-3 pr-3 font-mono text-xs text-blue-600">{order.orderId}</td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={order.customerName} size="sm" />
                      <span className="font-medium text-slate-700">{order.customerName}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-slate-500">{order.eventDate}</td>
                  <td className="py-3 pr-3 font-semibold text-slate-800">{formatCurrency(order.value)}</td>
                  <td className="py-3 pr-3">
                    <Badge variant={getStatusBadgeVariant(order.status)}>{ORDER_STATUS_LABEL[order.status] ?? order.status}</Badge>
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={order.assignee} size="sm" />
                      <span className="text-slate-600">{order.assignee}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-0 text-right">
                    <button type="button" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                  {isLoading ? 'Đang tải...' : 'Không có đơn đặt phù hợp.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          Hiển thị {filtered.length === 0 ? 0 : 1} đến {filtered.length} trong tổng số {filtered.length} đơn đặt
        </span>
        <div className="flex items-center gap-1">
          <button type="button" disabled className="rounded-md p-1.5 text-slate-300">
            ‹
          </button>
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-xs font-semibold text-white">1</span>
          <button type="button" disabled className="rounded-md p-1.5 text-slate-300">
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
