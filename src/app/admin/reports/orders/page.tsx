'use client';

import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, XCircle, CheckCircle2, Activity } from 'lucide-react';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import OrderStatusDonut from '@/components/dashboard/OrderStatusDonut';
import { Table, TableColumn } from '@/components/ui/Table';
import Reveal from '@/components/ui/Reveal';
import { orderApiService } from '@/services/order.service';
import type { Order } from '@/types/order';
import type { OrderStatusSlice } from '@/types/dashboard';

interface TypeRow {
  eventType: string;
  count: number;
  completed: number;
  cancelled: number;
}

const STATUS_META = [
  { key: 'new', label: 'Mới', color: '#94a3b8' },
  { key: 'confirmed', label: 'Xác nhận', color: '#3b82f6' },
  { key: 'inProgress', label: 'Đang làm', color: '#f97316' },
  { key: 'completed', label: 'Hoàn thành', color: '#22c55e' },
  { key: 'cancelled', label: 'Đã hủy', color: '#ef4444' },
];

export default function Page() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orderApiService
      .getOrders({ limit: 100 })
      .then((res) => {
        setOrders((res.data ?? []) as Order[]);
        setCounts((res.meta?.counts ?? {}) as Record<string, number>);
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const { donut, byType, kpis } = useMemo(() => {
    const donut: OrderStatusSlice[] = STATUS_META.map((m) => ({ label: m.label, color: m.color, count: counts[m.key] ?? 0 }));
    const total = donut.reduce((s, d) => s + d.count, 0);
    const cancelled = counts.cancelled ?? 0;
    const completed = counts.completed ?? 0;

    const typeMap = new Map<string, TypeRow>();
    for (const o of orders) {
      const t = o.eventType || 'Khác';
      const row = typeMap.get(t) ?? { eventType: t, count: 0, completed: 0, cancelled: 0 };
      row.count += 1;
      if (o.orderStatus === 'COMPLETED') row.completed += 1;
      if (o.orderStatus === 'CANCELLED') row.cancelled += 1;
      typeMap.set(t, row);
    }

    return {
      donut,
      byType: [...typeMap.values()].sort((a, b) => b.count - a.count),
      kpis: {
        total,
        cancelRate: total > 0 ? (cancelled / total) * 100 : 0,
        completeRate: total > 0 ? (completed / total) * 100 : 0,
        inProgress: counts.inProgress ?? 0,
      },
    };
  }, [orders, counts]);

  const totalOrders = donut.reduce((s, d) => s + d.count, 0);

  const items: KpiCardItem[] = [
    { label: 'Tổng đơn hàng', value: kpis.total, icon: ShoppingCart, iconColor: 'blue' },
    { label: 'Tỷ lệ hoàn thành', value: `${kpis.completeRate.toFixed(1)}%`, icon: CheckCircle2, iconColor: 'green' },
    { label: 'Tỷ lệ hủy', value: `${kpis.cancelRate.toFixed(1)}%`, icon: XCircle, iconColor: 'pink', changeDirection: 'down' },
    { label: 'Đang thực hiện', value: kpis.inProgress, icon: Activity, iconColor: 'amber' },
  ];

  const cols: TableColumn<TypeRow>[] = [
    { key: 'eventType', label: 'Loại sự kiện', render: (r) => <span className="font-semibold text-slate-800">{r.eventType}</span> },
    { key: 'count', label: 'Tổng', className: 'text-center', render: (r) => r.count },
    { key: 'completed', label: 'Hoàn thành', className: 'text-center', render: (r) => <span className="text-emerald-600 font-bold">{r.completed}</span> },
    { key: 'cancelled', label: 'Đã hủy', className: 'text-center', render: (r) => <span className="text-rose-500 font-bold">{r.cancelled}</span> },
  ];

  return (
    <div className="p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Thống kê đơn hàng</h1>
        <p className="mt-1 text-sm text-slate-500">Cơ cấu trạng thái, tỷ lệ hoàn thành/hủy và phân bố theo loại sự kiện.</p>
      </div>

      <div className="mt-6">
        <DashboardStats items={items} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Reveal>
          <OrderStatusDonut data={donut} total={totalOrders} />
        </Reveal>
        <Reveal delay={0.05} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs lg:col-span-2">
          <h3 className="text-sm font-extrabold text-slate-800">Đơn theo loại sự kiện</h3>
          <div className="mt-3">
            <Table columns={cols} rows={byType} rowKey={(r) => r.eventType} isLoading={loading} emptyText="Chưa có dữ liệu." />
          </div>
        </Reveal>
      </div>
    </div>
  );
}
