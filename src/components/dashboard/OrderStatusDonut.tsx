'use client';

import Link from 'next/link';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { OrderStatusSlice } from '@/types/dashboard';

interface OrderStatusDonutProps {
  data: OrderStatusSlice[];
  total: number;
  /** Có thì hiện link "Xem chi tiết" ở cuối card (vd trang danh sách đơn). */
  viewDetailHref?: string;
}

export default function OrderStatusDonut({ data, total, viewDetailHref }: Readonly<OrderStatusDonutProps>) {
  return (
    <div className="flex h-full flex-col rounded-xl bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Trạng thái đơn đặt</h3>

      <div className="relative mt-2 flex items-center justify-center">
        <div className="h-40 w-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="label" innerRadius={52} outerRadius={72} paddingAngle={2} strokeWidth={0}>
                {data.map((slice) => (
                  <Cell key={slice.label} fill={slice.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="pointer-events-none absolute flex flex-col items-center">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tổng</span>
          <span className="text-2xl font-bold text-slate-900">{total}</span>
        </div>
      </div>

      <ul className="mt-3 flex-1 space-y-1.5 text-xs">
        {data.map((slice) => (
          <li key={slice.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
              {slice.label}:
            </span>
            <span className="font-semibold text-slate-800">
              {slice.count} ({((slice.count / total) * 100).toFixed(1)}%)
            </span>
          </li>
        ))}
      </ul>

      {viewDetailHref && (
        <Link href={viewDetailHref} className="mt-3 text-xs font-semibold text-blue-600 hover:underline">
          Xem chi tiết
        </Link>
      )}
    </div>
  );
}
