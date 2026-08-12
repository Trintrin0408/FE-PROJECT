'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, DollarSign, Receipt, TrendingUp, Truck, Wallet } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import { ChartSkeleton, DataBlock, KpiSkeleton } from '@/components/ui/Skeleton';
import OrderStatusDonut from '@/components/reports/OrderStatusDonut';
import {
  EventTypeBar,
  KpiTile,
  RevenueTrendChart,
  RevenueVsCostChart,
  StatusDonut,
  TopCustomersBar,
  type DonutSlice,
  type TrendPoint,
} from '@/components/reports/revenueWidgets';
import { useAsyncData } from '@/hooks/useAsyncData';
import { orderApiService } from '@/services/order.service';
import { paymentApiService } from '@/services/payment.service';
import { supplierApiService } from '@/services/supplier.service';
import { ORDER_PAYMENT_STATUS_LABEL, ORDER_STATUS_LABEL } from '@/constants/order-status';
import { formatCurrency } from '@/utils/formatCurrency';
import { toDateInputValue } from '@/utils/formatDate';
import type { Order } from '@/types/order';

// ── Helpers khoảng ngày / tháng ──────────────────────────────────────────────────────────────────
function isoOf(d: Date): string {
  return toDateInputValue(d.getTime());
}
function monthKeysBetween(fromKey: string, toKey: string): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  let y = Number(fromKey.slice(0, 4));
  let m = Number(fromKey.slice(5, 7));
  const endY = Number(toKey.slice(0, 4));
  const endM = Number(toKey.slice(5, 7));
  let guard = 0;
  while ((y < endY || (y === endY && m <= endM)) && guard < 60) {
    out.push({ key: `${y}-${String(m).padStart(2, '0')}`, label: `${m}/${y}` });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    guard += 1;
  }
  return out;
}

const PALETTE_PAYMENT: Record<string, string> = { UNPAID: '#94a3b8', DEPOSITED: '#f59e0b', PAID: '#16a34a' };

export default function Page() {
  // Khoảng ngày mặc định set ở useEffect (chỉ chạy client) để KHÔNG lệch server/client render — new Date()
  // khác nhau giữa 2 phía sẽ gây hydration mismatch ở ô <input type="date">. Ban đầu rỗng, effect điền sau.
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  useEffect(() => {
    const n = new Date();
    setFrom(isoOf(new Date(n.getFullYear(), n.getMonth() - 11, 1)));
    setTo(isoOf(n));
  }, []);

  // 3 nguồn dữ liệu ĐỘC LẬP — mỗi nguồn tự shimmer riêng khi tải; filter ngày lọc lại phía client (không refetch).
  // BE chặn limit ≤ 100; supplier-transactions KHÔNG truyền limit để lấy hết (endpoint trả toàn bộ khi thiếu page/limit).
  const ordersQ = useAsyncData<Order[]>(() => orderApiService.getOrders({ limit: 100 }).then((r) => (r.data ?? []) as Order[]), []);
  const depositsQ = useAsyncData(() => paymentApiService.getDeposits({ limit: 100 }).then((r) => r.data ?? []), []);
  const supplierQ = useAsyncData(() => supplierApiService.getSupplierTransactions().then((r) => r.data ?? []), []);

  const orders = ordersQ.data ?? [];
  const deposits = depositsQ.data ?? [];
  const supplierTx = supplierQ.data ?? [];

  const agg = useMemo(() => {
    const inRange = (dateStr: string | null | undefined) => {
      if (!dateStr) return false;
      const k = toDateInputValue(dateStr);
      return k >= from && k <= to;
    };
    const monthKey = (dateStr: string) => toDateInputValue(dateStr).slice(0, 7);
    const months = monthKeysBetween(from, to);

    const activeOrders = orders.filter((o) => o.orderStatus !== 'CANCELLED' && inRange(o.eventDate));
    const paidDeposits = deposits.filter((d) => d.status === 'PAID' && inRange(d.createdAt));
    const activeTx = supplierTx.filter((t) => t.status !== 'CANCELLED' && inRange(t.createdAt));

    // KPI
    const totalBooked = activeOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
    const totalCollected = paidDeposits.reduce((s, d) => s + (d.amount ?? 0), 0);
    const supplierCost = activeTx.reduce((s, t) => s + (t.estimatedCost ?? 0), 0);
    const receivables = Math.max(0, totalBooked - totalCollected);
    const grossProfit = totalBooked - supplierCost;
    const orderCount = activeOrders.length;
    const completedCount = activeOrders.filter((o) => o.orderStatus === 'COMPLETED').length;
    const aov = orderCount > 0 ? totalBooked / orderCount : 0;

    // Trend theo tháng: doanh thu đặt (eventDate) vs đã thu (cọc createdAt)
    const bookedByM = new Map<string, number>();
    const revByM = new Map<string, number>();
    for (const o of activeOrders) {
      const mk = monthKey(o.eventDate);
      bookedByM.set(mk, (bookedByM.get(mk) ?? 0) + (o.totalAmount ?? 0));
      revByM.set(mk, (revByM.get(mk) ?? 0) + (o.totalAmount ?? 0));
    }
    const collectedByM = new Map<string, number>();
    for (const d of paidDeposits) {
      const mk = monthKey(d.createdAt);
      collectedByM.set(mk, (collectedByM.get(mk) ?? 0) + (d.amount ?? 0));
    }
    const costByM = new Map<string, number>();
    for (const t of activeTx) {
      const mk = monthKey(t.createdAt);
      costByM.set(mk, (costByM.get(mk) ?? 0) + (t.estimatedCost ?? 0));
    }
    const trend: TrendPoint[] = months.map((m) => ({ month: m.label, booked: bookedByM.get(m.key) ?? 0, collected: collectedByM.get(m.key) ?? 0 }));
    const revVsCost = months.map((m) => ({ month: m.label, revenue: revByM.get(m.key) ?? 0, cost: costByM.get(m.key) ?? 0 }));

    // Theo loại sự kiện
    const typeMap = new Map<string, number>();
    for (const o of activeOrders) typeMap.set(o.eventType || 'Khác', (typeMap.get(o.eventType || 'Khác') ?? 0) + (o.totalAmount ?? 0));
    const byType = [...typeMap.entries()].map(([eventType, revenue]) => ({ eventType, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    // Donut cơ cấu thanh toán (số đơn theo paymentStatus)
    const payCount = new Map<string, number>();
    for (const o of activeOrders) payCount.set(o.paymentStatus, (payCount.get(o.paymentStatus) ?? 0) + 1);
    const paymentDonut: DonutSlice[] = ['UNPAID', 'DEPOSITED', 'PAID']
      .map((k) => ({ label: ORDER_PAYMENT_STATUS_LABEL[k] ?? k, value: payCount.get(k) ?? 0, color: PALETTE_PAYMENT[k] }))
      .filter((s) => s.value > 0);

    // Donut trạng thái đơn
    const statusCount = new Map<string, number>();
    for (const o of activeOrders) statusCount.set(o.orderStatus, (statusCount.get(o.orderStatus) ?? 0) + 1);
    const orderStatusDonut = ['NEW', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED']
      .map((k) => ({ status: ORDER_STATUS_LABEL[k] ?? k, value: statusCount.get(k) ?? 0 }))
      .filter((s) => s.value > 0);

    // Top khách hàng
    const custMap = new Map<string, number>();
    for (const o of activeOrders) custMap.set(o.customerName || 'Khách lẻ', (custMap.get(o.customerName || 'Khách lẻ') ?? 0) + (o.totalAmount ?? 0));
    const topCustomers = [...custMap.entries()]
      .map(([name, revenue]) => ({ name: name.length > 16 ? `${name.slice(0, 15)}…` : name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      totalBooked,
      totalCollected,
      supplierCost,
      receivables,
      grossProfit,
      orderCount,
      completedCount,
      aov,
      trend,
      revVsCost,
      byType,
      paymentDonut,
      orderStatusDonut,
      topCustomers,
    };
  }, [orders, deposits, supplierTx, from, to]);

  // Loading gộp theo nguồn (mỗi widget shimmer theo đúng nguồn nó cần)
  const ordersLoading = ordersQ.loading;
  const depositsLoading = depositsQ.loading;
  const supplierLoading = supplierQ.loading;

  const presets: { label: string; apply: () => void }[] = [
    { label: '6 tháng', apply: () => { const n = new Date(); setFrom(isoOf(new Date(n.getFullYear(), n.getMonth() - 5, 1))); setTo(isoOf(n)); } },
    { label: '12 tháng', apply: () => { const n = new Date(); setFrom(isoOf(new Date(n.getFullYear(), n.getMonth() - 11, 1))); setTo(isoOf(n)); } },
    { label: 'Quý này', apply: () => { const n = new Date(); setFrom(isoOf(new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1))); setTo(isoOf(n)); } },
    { label: 'Năm nay', apply: () => { const n = new Date(); setFrom(isoOf(new Date(n.getFullYear(), 0, 1))); setTo(isoOf(n)); } },
  ];

  return (
    <div className="p-6">
      {/* Header + filter */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Báo cáo doanh thu</h1>
          <p className="mt-1 text-sm text-slate-500">Doanh thu đặt, tiền đã thu, chi phí NCC và lợi nhuận gộp — tổng hợp từ đơn hiệu lực (bỏ đơn đã hủy).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <button key={p.label} onClick={p.apply} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              {p.label}
            </button>
          ))}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1">
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="bg-transparent text-xs text-slate-700 outline-none" />
            <span className="text-xs text-slate-400">→</span>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="bg-transparent text-xs text-slate-700 outline-none" />
          </div>
        </div>
      </div>

      {/* KPI row — mỗi thẻ shimmer độc lập theo nguồn */}
      <Reveal className="mt-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <DataBlock loading={ordersLoading} error={ordersQ.error} fallback={<KpiSkeleton />}>
            <KpiTile label="Tổng doanh thu đặt" value={formatCurrency(agg.totalBooked)} sub={`${agg.orderCount} đơn hiệu lực`} icon={DollarSign} tone="blue" />
          </DataBlock>
          <DataBlock loading={depositsLoading} error={depositsQ.error} fallback={<KpiSkeleton />}>
            <KpiTile label="Đã thu (cọc)" value={formatCurrency(agg.totalCollected)} sub="Khoản cọc đã xác nhận" icon={Wallet} tone="green" />
          </DataBlock>
          <DataBlock loading={ordersLoading || depositsLoading} error={ordersQ.error} fallback={<KpiSkeleton />}>
            <KpiTile label="Công nợ phải thu" value={formatCurrency(agg.receivables)} sub="Doanh thu − đã thu" icon={Receipt} tone="amber" />
          </DataBlock>
          <DataBlock loading={supplierLoading} error={supplierQ.error} fallback={<KpiSkeleton />}>
            <KpiTile label="Chi phí NCC" value={formatCurrency(agg.supplierCost)} sub="Thuê/mua nhà cung cấp" icon={Truck} tone="red" />
          </DataBlock>
          <DataBlock loading={ordersLoading || supplierLoading} error={ordersQ.error} fallback={<KpiSkeleton />}>
            <KpiTile label="Lợi nhuận gộp (ước tính)" value={formatCurrency(agg.grossProfit)} sub="Doanh thu − chi phí NCC" icon={TrendingUp} tone="violet" />
          </DataBlock>
          <DataBlock loading={ordersLoading} error={ordersQ.error} fallback={<KpiSkeleton />}>
            <KpiTile label="Giá trị TB/đơn" value={formatCurrency(agg.aov)} sub={`${agg.completedCount} đơn hoàn thành`} icon={BarChart3} tone="slate" />
          </DataBlock>
        </div>
      </Reveal>

      {/* Hàng B: trend (rộng) + donut thanh toán */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <DataBlock loading={ordersLoading || depositsLoading} error={ordersQ.error} fallback={<ChartSkeleton heightClass="h-72" />}>
            <RevenueTrendChart data={agg.trend} />
          </DataBlock>
        </Reveal>
        <Reveal delay={0.05}>
          <DataBlock loading={ordersLoading} error={ordersQ.error} fallback={<ChartSkeleton heightClass="h-72" />}>
            <StatusDonut title="Cơ cấu thanh toán" subtitle="Số đơn theo trạng thái thanh toán" centerLabel="Tổng đơn" data={agg.paymentDonut} />
          </DataBlock>
        </Reveal>
      </div>

      {/* Hàng C: bar loại sự kiện (rộng) + donut trạng thái đơn */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <DataBlock loading={ordersLoading} error={ordersQ.error} fallback={<ChartSkeleton heightClass="h-72" />}>
            <EventTypeBar data={agg.byType} />
          </DataBlock>
        </Reveal>
        <Reveal delay={0.05}>
          <DataBlock loading={ordersLoading} error={ordersQ.error} fallback={<ChartSkeleton heightClass="h-72" />}>
            <OrderStatusDonut data={agg.orderStatusDonut} />
          </DataBlock>
        </Reveal>
      </div>

      {/* Hàng D: doanh thu vs chi phí (rộng) + top khách hàng */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <DataBlock loading={ordersLoading || supplierLoading} error={ordersQ.error} fallback={<ChartSkeleton heightClass="h-72" />}>
            <RevenueVsCostChart data={agg.revVsCost} />
          </DataBlock>
        </Reveal>
        <Reveal delay={0.05}>
          <DataBlock loading={ordersLoading} error={ordersQ.error} fallback={<ChartSkeleton heightClass="h-72" />}>
            <TopCustomersBar data={agg.topCustomers} />
          </DataBlock>
        </Reveal>
      </div>
    </div>
  );
}
