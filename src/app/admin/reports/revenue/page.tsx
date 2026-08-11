'use client';

import { useEffect, useMemo, useState } from 'react';
import { DollarSign, CalendarCheck, TrendingUp, Receipt } from 'lucide-react';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import RevenueChart from '@/components/reports/RevenueChart';
import { Table, TableColumn } from '@/components/ui/Table';
import Reveal from '@/components/ui/Reveal';
import { orderApiService } from '@/services/order.service';
import { formatCurrency } from '@/utils/formatCurrency';
import { toDateInputValue } from '@/utils/formatDate';
import type { Order } from '@/types/order';
import type { RevenueReportPoint } from '@/types/report';

interface EventTypeRow {
  eventType: string;
  orders: number;
  revenue: number;
}

export default function Page() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orderApiService
      .getOrders({ limit: 100 })
      .then((res) => setOrders((res.data ?? []) as Order[]))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const { kpis, trend, byType } = useMemo(() => {
    const active = orders.filter((o) => o.orderStatus !== 'CANCELLED');
    const todayKey = toDateInputValue(Date.now());
    const curMonth = todayKey.slice(0, 7);

    // Doanh thu theo tháng (12 tháng gần nhất, theo eventDate)
    const revByMonth = new Map<string, number>();
    for (const o of active) {
      const mk = toDateInputValue(o.eventDate).slice(0, 7);
      revByMonth.set(mk, (revByMonth.get(mk) ?? 0) + (o.totalAmount ?? 0));
    }
    const base = new Date(`${curMonth}-01T12:00:00Z`);
    const trend: RevenueReportPoint[] = [];
    for (let i = 11; i >= 0; i -= 1) {
      const m = new Date(base);
      m.setUTCMonth(m.getUTCMonth() - i);
      const key = m.toISOString().slice(0, 7);
      trend.push({ month: `${m.getUTCMonth() + 1}/${m.getUTCFullYear()}`, revenue: revByMonth.get(key) ?? 0 });
    }

    // Theo loại sự kiện
    const typeMap = new Map<string, EventTypeRow>();
    for (const o of active) {
      const t = o.eventType || 'Khác';
      const row = typeMap.get(t) ?? { eventType: t, orders: 0, revenue: 0 };
      row.orders += 1;
      row.revenue += o.totalAmount ?? 0;
      typeMap.set(t, row);
    }
    const byType = [...typeMap.values()].sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = active.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
    const completed = orders.filter((o) => o.orderStatus === 'COMPLETED').length;
    const avg = active.length > 0 ? totalRevenue / active.length : 0;

    return {
      trend,
      byType,
      kpis: {
        totalRevenue,
        monthRevenue: revByMonth.get(curMonth) ?? 0,
        completed,
        avg,
      },
    };
  }, [orders]);

  const items: KpiCardItem[] = [
    { label: 'Tổng doanh thu (đơn hiệu lực)', value: formatCurrency(kpis.totalRevenue), icon: DollarSign, iconColor: 'blue' },
    { label: 'Doanh thu tháng này', value: formatCurrency(kpis.monthRevenue), icon: TrendingUp, iconColor: 'green' },
    { label: 'Đơn hoàn thành', value: kpis.completed, icon: CalendarCheck, iconColor: 'amber' },
    { label: 'Giá trị trung bình/đơn', value: formatCurrency(kpis.avg), icon: Receipt, iconColor: 'pink' },
  ];

  const cols: TableColumn<EventTypeRow>[] = [
    { key: 'eventType', label: 'Loại sự kiện', render: (r) => <span className="font-semibold text-slate-800">{r.eventType}</span> },
    { key: 'orders', label: 'Số đơn', className: 'text-center', render: (r) => r.orders },
    { key: 'revenue', label: 'Doanh thu', className: 'text-right', render: (r) => <span className="font-bold text-slate-800">{formatCurrency(r.revenue)}</span> },
  ];

  return (
    <div className="p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Báo cáo doanh thu</h1>
        <p className="mt-1 text-sm text-slate-500">Doanh thu theo tháng và loại sự kiện — tổng hợp từ đơn hàng hiệu lực (không tính đơn đã hủy).</p>
      </div>

      <div className="mt-6">
        <DashboardStats items={items} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <RevenueChart data={trend} />
        </Reveal>
        <Reveal delay={0.05} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <h3 className="text-sm font-extrabold text-slate-800">Doanh thu theo loại sự kiện</h3>
          <div className="mt-3">
            <Table columns={cols} rows={byType} rowKey={(r) => r.eventType} isLoading={loading} emptyText="Chưa có dữ liệu." />
          </div>
        </Reveal>
      </div>
    </div>
  );
}
