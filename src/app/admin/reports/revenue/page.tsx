'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, DollarSign, Receipt, TrendingUp, Truck, Wallet } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import { ChartSkeleton, DataBlock, KpiSkeleton } from '@/components/ui/Skeleton';
import {
  KpiTile,
  MonthlyMoneyChart,
  StatusDonut,
  TopCustomersBar,
  formatMillions,
  type DonutSlice,
  type MonthlyMoneyPoint,
} from '@/components/reports/revenueWidgets';
import { useAsyncData } from '@/hooks/useAsyncData';
import { orderApiService } from '@/services/order.service';
import { paymentApiService, type DepositListItem } from '@/services/payment.service';
import { supplierApiService } from '@/services/supplier.service';
import { formatCurrency } from '@/utils/formatCurrency';
import { toDateInputValue } from '@/utils/formatDate';
import type { Order } from '@/types/order';
import type { SupplierTransaction } from '@/types/supplier';

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

// Lấy HẾT bản ghi qua phân trang (BE không có endpoint tổng hợp; mỗi list trả meta.totalPages). Tránh
// bug cũ chỉ lấy trang đầu (orders/deposits ≤ 100, supplier-tx MẶC ĐỊNH chỉ 20) khiến tổng bị thiếu.
async function fetchAllPages<T>(
  getPage: (page: number, limit: number) => Promise<{ data?: T[] | null; meta?: { totalPages?: number } | null }>,
  limit: number,
): Promise<T[]> {
  const first = await getPage(1, limit);
  const out: T[] = [...(first.data ?? [])];
  const totalPages = first.meta?.totalPages ?? 1;
  if (totalPages > 1) {
    const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, i) => getPage(i + 2, limit)));
    for (const r of rest) out.push(...(r.data ?? []));
  }
  return out;
}

// "Hợp đồng đã chốt" = đơn đã xác nhận trở lên (bỏ đơn NEW nháp + đơn đã hủy). deposit_paid/
// settlement_pending KHÔNG phải trạng thái thật (chỉ có 5 giá trị), tiến độ tiền nằm ở paymentStatus.
const COMMITTED_STATUSES = new Set(['CONFIRMED', 'IN_PROGRESS', 'COMPLETED']);

export default function Page() {
  // Khoảng ngày mặc định set ở useEffect (chỉ chạy client) để KHÔNG lệch server/client render (hydration).
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  useEffect(() => {
    const n = new Date();
    setFrom(isoOf(new Date(n.getFullYear(), n.getMonth() - 11, 1)));
    setTo(isoOf(n));
  }, []);

  // 3 nguồn ĐỘC LẬP — mỗi nguồn tự shimmer riêng; lấy HẾT trang; filter ngày lọc lại phía client.
  const ordersQ = useAsyncData<Order[]>(
    () => fetchAllPages<Order>((page, limit) => orderApiService.getOrders({ page, limit }), 100),
    [],
  );
  const depositsQ = useAsyncData<DepositListItem[]>(
    () => fetchAllPages<DepositListItem>((page, limit) => paymentApiService.getDeposits({ page, limit }), 100),
    [],
  );
  const supplierQ = useAsyncData<SupplierTransaction[]>(
    () => fetchAllPages<SupplierTransaction>((page, limit) => supplierApiService.getSupplierTransactions({ page, limit }), 200),
    [],
  );

  const orders = useMemo(() => ordersQ.data ?? [], [ordersQ.data]);
  const deposits = useMemo(() => depositsQ.data ?? [], [depositsQ.data]);
  const supplierTx = useMemo(() => supplierQ.data ?? [], [supplierQ.data]);

  const agg = useMemo(() => {
    const inRange = (dateStr: string | null | undefined) => {
      if (!dateStr) return false;
      const k = toDateInputValue(dateStr);
      return k >= from && k <= to;
    };
    const monthKey = (dateStr: string) => toDateInputValue(dateStr).slice(0, 7);
    const months = monthKeysBetween(from, to);

    // Tiền cọc ĐÃ THU gộp theo đơn — để suy ra tiền thực thu chính xác (kể cả tất toán cuối, vì
    // settlement không có endpoint list; đơn paymentStatus=PAID nghĩa là đã thu đủ totalAmount).
    const paidDepositByOrder = new Map<string, number>();
    for (const d of deposits) {
      if (d.status === 'PAID') paidDepositByOrder.set(d.orderId, (paidDepositByOrder.get(d.orderId) ?? 0) + (d.amount ?? 0));
    }
    const collectedOf = (o: Order) =>
      o.paymentStatus === 'PAID' ? o.totalAmount ?? 0 : paidDepositByOrder.get(o.orderId) ?? 0;

    const committedOrders = orders.filter((o) => COMMITTED_STATUSES.has(o.orderStatus) && inRange(o.eventDate));

    // KPI dòng tiền: Hợp đồng chốt → Đã thu → Còn phải thu
    const committed = committedOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
    const collected = committedOrders.reduce((s, o) => s + collectedOf(o), 0);
    const outstanding = Math.max(0, committed - collected);
    const collectionRate = committed > 0 ? collected / committed : 0;

    const activeTx = supplierTx.filter((t) => t.status !== 'CANCELLED' && inRange(t.createdAt));
    const supplierCost = activeTx.reduce((s, t) => s + (t.estimatedCost ?? 0), 0);
    const revenueAfterSupplier = committed - supplierCost;

    const orderCount = committedOrders.length;
    const completedCount = committedOrders.filter((o) => o.orderStatus === 'COMPLETED').length;
    const aov = orderCount > 0 ? committed / orderCount : 0;

    // Cột chồng theo THÁNG SỰ KIỆN (một trục thời gian nhất quán): đã thu + còn phải thu = hợp đồng chốt.
    const committedByM = new Map<string, number>();
    const collectedByM = new Map<string, number>();
    for (const o of committedOrders) {
      const mk = monthKey(o.eventDate);
      committedByM.set(mk, (committedByM.get(mk) ?? 0) + (o.totalAmount ?? 0));
      collectedByM.set(mk, (collectedByM.get(mk) ?? 0) + collectedOf(o));
    }
    const monthly: MonthlyMoneyPoint[] = months.map((m) => {
      const c = committedByM.get(m.key) ?? 0;
      const paid = collectedByM.get(m.key) ?? 0;
      return { month: m.label, collected: paid, outstanding: Math.max(0, c - paid) };
    });

    // Donut cơ cấu thu tiền (theo tiền, không phải số đơn)
    const collectionDonut: DonutSlice[] = [
      { label: 'Đã thu', value: collected, color: '#16a34a' },
      { label: 'Còn phải thu', value: outstanding, color: '#f59e0b' },
    ].filter((s) => s.value > 0);

    // Doanh thu theo loại sự kiện (giá trị hợp đồng chốt)
    const typeMap = new Map<string, number>();
    for (const o of committedOrders) typeMap.set(o.eventType || 'Khác', (typeMap.get(o.eventType || 'Khác') ?? 0) + (o.totalAmount ?? 0));
    const byType = [...typeMap.entries()].map(([eventType, revenue]) => ({ eventType, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    // Top khách hàng
    const custMap = new Map<string, number>();
    for (const o of committedOrders) custMap.set(o.customerName || 'Khách lẻ', (custMap.get(o.customerName || 'Khách lẻ') ?? 0) + (o.totalAmount ?? 0));
    const topCustomers = [...custMap.entries()]
      .map(([name, revenue]) => ({ name: name.length > 16 ? `${name.slice(0, 15)}…` : name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      committed,
      collected,
      outstanding,
      collectionRate,
      supplierCost,
      revenueAfterSupplier,
      orderCount,
      completedCount,
      aov,
      monthly,
      collectionDonut,
      byType,
      topCustomers,
    };
  }, [orders, deposits, supplierTx, from, to]);

  const ordersLoading = ordersQ.loading;
  const depositsLoading = depositsQ.loading;
  const supplierLoading = supplierQ.loading;
  const moneyLoading = ordersLoading || depositsLoading;
  const moneyError = ordersQ.error ?? depositsQ.error;

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
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi dòng tiền: giá trị hợp đồng đã chốt (đơn đã xác nhận trở lên) → đã thu → còn phải thu. Chi phí NCC là ước tính.
          </p>
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

      {/* KPI row — kể đúng dòng tiền */}
      <Reveal className="mt-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <DataBlock loading={ordersLoading} error={ordersQ.error} fallback={<KpiSkeleton />}>
            <KpiTile label="Giá trị hợp đồng đã chốt" value={formatCurrency(agg.committed)} sub={`${agg.orderCount} đơn đã chốt`} icon={DollarSign} tone="blue" />
          </DataBlock>
          <DataBlock loading={moneyLoading} error={moneyError} fallback={<KpiSkeleton />}>
            <KpiTile label="Đã thu" value={formatCurrency(agg.collected)} sub={`Tỷ lệ thu ${Math.round(agg.collectionRate * 100)}%`} icon={Wallet} tone="green" />
          </DataBlock>
          <DataBlock loading={moneyLoading} error={moneyError} fallback={<KpiSkeleton />}>
            <KpiTile label="Còn phải thu" value={formatCurrency(agg.outstanding)} sub="Hợp đồng chốt − đã thu" icon={Receipt} tone="amber" />
          </DataBlock>
          <DataBlock loading={supplierLoading} error={supplierQ.error} fallback={<KpiSkeleton />}>
            <KpiTile label="Chi phí NCC" value={formatCurrency(agg.supplierCost)} sub="Thuê/mua trong kỳ" icon={Truck} tone="red" />
          </DataBlock>
          <DataBlock loading={ordersLoading || supplierLoading} error={ordersQ.error ?? supplierQ.error} fallback={<KpiSkeleton />}>
            <KpiTile label="Doanh thu sau chi phí NCC" value={formatCurrency(agg.revenueAfterSupplier)} sub="Ước tính · hợp đồng − NCC" icon={TrendingUp} tone="violet" />
          </DataBlock>
          <DataBlock loading={ordersLoading} error={ordersQ.error} fallback={<KpiSkeleton />}>
            <KpiTile label="Giá trị TB/đơn" value={formatCurrency(agg.aov)} sub={`${agg.completedCount} đơn hoàn thành`} icon={BarChart3} tone="slate" />
          </DataBlock>
        </div>
      </Reveal>

      {/* Hàng A: cột chồng theo tháng (rộng) + donut cơ cấu thu tiền */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <DataBlock loading={moneyLoading} error={moneyError} fallback={<ChartSkeleton heightClass="h-72" />}>
            <MonthlyMoneyChart data={agg.monthly} />
          </DataBlock>
        </Reveal>
        <Reveal delay={0.05}>
          <DataBlock loading={moneyLoading} error={moneyError} fallback={<ChartSkeleton heightClass="h-72" />}>
            <StatusDonut
              title="Cơ cấu thu tiền"
              subtitle="Đã thu vs còn phải thu (theo tiền)"
              centerLabel="Hợp đồng đã chốt"
              valueFormat={formatCurrency}
              centerFormat={(n) => `${formatMillions(n)} đ`}
              unit="Số tiền"
              data={agg.collectionDonut}
            />
          </DataBlock>
        </Reveal>
      </div>

      {/* Hàng B: top khách hàng (toàn chiều rộng) — đã ẩn "Doanh thu theo loại sự kiện" theo yêu cầu */}
      <div className="mt-6">
        <Reveal>
          <DataBlock loading={ordersLoading} error={ordersQ.error} fallback={<ChartSkeleton heightClass="h-72" />}>
            <TopCustomersBar data={agg.topCustomers} />
          </DataBlock>
        </Reveal>
      </div>
    </div>
  );
}
