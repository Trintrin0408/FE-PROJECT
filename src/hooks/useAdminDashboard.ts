import { useEffect, useState } from 'react';
import { orderApiService } from '@/services/order.service';
import { quotationApiService } from '@/services/quotation.service';
import { customerApiService } from '@/services/customer.service';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import { formatDate, formatTime, toDateInputValue } from '@/utils/formatDate';
import type { Order, OrderStatus } from '@/types/order';
import type { SchedulePlan } from '@/types/schedulePlan';
import type { OrderStatusSlice, RecentOrderRow, UpcomingEvent } from '@/types/dashboard';
import type { RevenueReportPoint } from '@/types/report';
import type { StaffDutyStatus, StaffOnDuty } from '@/mocks/adminDashboard';

// Không có endpoint /dashboard/admin hay /reports/revenue thật (đều 404) — trang Tổng quan Admin tổng
// hợp client-side từ các API rời rạc đã xác nhận thật: /orders (+ meta.counts), /quotations (meta.counts),
// /customers, /schedule-plans. Cùng cách làm với useManagerDashboard.

export interface AdminDashboardKpis {
  monthlyRevenue: number;
  monthlyRevenueChangeLabel: string;
  monthlyRevenueChangeDirection: 'up' | 'down';
  newOrders: number;
  newOrdersChangeLabel: string;
  newOrdersChangeDirection: 'up' | 'down';
  pendingQuotations: number;
  newCustomers: number;
  newCustomersChangeLabel: string;
  newCustomersChangeDirection: 'up' | 'down';
}

const EMPTY_KPIS: AdminDashboardKpis = {
  monthlyRevenue: 0,
  monthlyRevenueChangeLabel: '',
  monthlyRevenueChangeDirection: 'up',
  newOrders: 0,
  newOrdersChangeLabel: '',
  newOrdersChangeDirection: 'up',
  pendingQuotations: 0,
  newCustomers: 0,
  newCustomersChangeLabel: '',
  newCustomersChangeDirection: 'up',
};

const STATUS_SLICE_META: { status: OrderStatus; label: string; color: string }[] = [
  { status: 'NEW', label: 'Mới', color: '#94a3b8' },
  { status: 'CONFIRMED', label: 'Xác nhận', color: '#3b82f6' },
  { status: 'IN_PROGRESS', label: 'Đang làm', color: '#f97316' },
  { status: 'COMPLETED', label: 'Hoàn thành', color: '#22c55e' },
  { status: 'CANCELLED', label: 'Đã hủy', color: '#ef4444' },
];

/** 'YYYY-MM' theo giờ VN của 1 mốc ISO. */
function monthKey(iso: string): string {
  return toDateInputValue(iso).slice(0, 7);
}

/** Nhãn thay đổi so tháng trước. */
function changeLabel(cur: number, prev: number): { label: string; dir: 'up' | 'down' } {
  if (prev <= 0) return { label: cur > 0 ? 'Mới trong tháng' : 'So với tháng trước', dir: 'up' };
  const pct = ((cur - prev) / prev) * 100;
  const dir = pct >= 0 ? 'up' : 'down';
  return { label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% so với tháng trước`, dir };
}

export function useAdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<AdminDashboardKpis>(EMPTY_KPIS);
  const [revenueTrend, setRevenueTrend] = useState<RevenueReportPoint[]>([]);
  const [orderStatusBreakdown, setOrderStatusBreakdown] = useState<OrderStatusSlice[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrderRow[]>([]);
  const [staffOnDuty, setStaffOnDuty] = useState<StaffOnDuty[]>([]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    Promise.all([
      orderApiService.getOrders({ limit: 100 }).catch(() => null),
      quotationApiService.getQuotations({ limit: 1 }).catch(() => null),
      customerApiService.getCustomers({ limit: 100 }).catch(() => null),
      schedulePlanApiService
        .getSchedulePlans({ dateFrom: '2026-01-01', dateTo: '2027-12-31', dateMode: 'plan', limit: 500 })
        .catch(() => null),
    ])
      .then(([ordersRes, quotesRes, customersRes, plansRes]) => {
        if (cancelled) return;

        const orders: Order[] = (ordersRes?.data ?? []) as Order[];
        const counts = (ordersRes?.meta?.counts ?? {}) as Record<string, number>;
        const plans: SchedulePlan[] = (plansRes?.data ?? []) as SchedulePlan[];

        const todayKey = toDateInputValue(Date.now());
        const curMonth = todayKey.slice(0, 7);
        // tháng trước (theo lịch)
        const d = new Date(`${todayKey}T12:00:00Z`);
        d.setUTCMonth(d.getUTCMonth() - 1);
        const prevMonth = d.toISOString().slice(0, 7);

        // ── Doanh thu theo tháng (đơn không hủy) ──
        const revByMonth = new Map<string, number>();
        for (const o of orders) {
          if (o.orderStatus === 'CANCELLED') continue;
          const mk = monthKey(o.eventDate);
          revByMonth.set(mk, (revByMonth.get(mk) ?? 0) + (o.totalAmount ?? 0));
        }
        // 6 tháng gần nhất tính tới tháng hiện tại
        const trend: RevenueReportPoint[] = [];
        const base = new Date(`${curMonth}-01T12:00:00Z`);
        for (let i = 5; i >= 0; i -= 1) {
          const m = new Date(base);
          m.setUTCMonth(m.getUTCMonth() - i);
          const key = m.toISOString().slice(0, 7);
          trend.push({ month: `${m.getUTCMonth() + 1}/${m.getUTCFullYear()}`, revenue: revByMonth.get(key) ?? 0 });
        }

        const monthlyRevenue = revByMonth.get(curMonth) ?? 0;
        const revChange = changeLabel(monthlyRevenue, revByMonth.get(prevMonth) ?? 0);

        // ── Đơn đặt mới (theo tháng tạo) ──
        const ordersThisMonth = orders.filter((o) => monthKey(o.createdAt) === curMonth).length;
        const ordersPrevMonth = orders.filter((o) => monthKey(o.createdAt) === prevMonth).length;
        const ordersChange = changeLabel(ordersThisMonth, ordersPrevMonth);

        // ── Khách hàng mới (theo tháng tạo) ──
        const customers = (customersRes?.data ?? []) as { createdAt?: string }[];
        const custThisMonth = customers.filter((c) => c.createdAt && monthKey(c.createdAt) === curMonth).length;
        const custPrevMonth = customers.filter((c) => c.createdAt && monthKey(c.createdAt) === prevMonth).length;
        const custChange = changeLabel(custThisMonth, custPrevMonth);
        const totalCustomers = customersRes?.meta?.totalItems ?? customers.length;

        setKpis({
          monthlyRevenue,
          monthlyRevenueChangeLabel: revChange.label,
          monthlyRevenueChangeDirection: revChange.dir,
          newOrders: ordersThisMonth,
          newOrdersChangeLabel: ordersChange.label,
          newOrdersChangeDirection: ordersChange.dir,
          pendingQuotations: quotesRes?.meta?.counts?.draft ?? 0,
          newCustomers: custThisMonth > 0 ? custThisMonth : totalCustomers,
          newCustomersChangeLabel: custThisMonth > 0 ? custChange.label : 'Tổng khách hàng',
          newCustomersChangeDirection: custChange.dir,
        });
        setRevenueTrend(trend);

        // ── Donut trạng thái ──
        const countByStatus: Record<string, number> = {
          NEW: counts.new ?? 0,
          CONFIRMED: counts.confirmed ?? 0,
          IN_PROGRESS: counts.inProgress ?? 0,
          COMPLETED: counts.completed ?? 0,
          CANCELLED: counts.cancelled ?? 0,
        };
        setOrderStatusBreakdown(
          STATUS_SLICE_META.map((m) => ({ label: m.label, color: m.color, count: countByStatus[m.status] ?? 0 })),
        );

        // LEAD theo đơn (cho cột phụ trách) + tải nhân sự
        const leadByOrder = new Map<string, string>();
        const planCountByStaff = new Map<string, string>(); // userId -> fullName
        const staffLoad = new Map<string, { name: string; count: number }>();
        for (const p of plans) {
          if (p.status === 'CANCELLED') continue;
          const lead = (p.assignees ?? []).find((a) => a.role === 'LEAD');
          if (lead && !leadByOrder.has(p.orderId)) leadByOrder.set(p.orderId, lead.fullName);
          for (const a of p.assignees ?? []) {
            planCountByStaff.set(a.userId, a.fullName);
            const cur = staffLoad.get(a.userId) ?? { name: a.fullName, count: 0 };
            cur.count += 1;
            staffLoad.set(a.userId, cur);
          }
        }

        // ── Sự kiện sắp tới ──
        setUpcomingEvents(
          orders
            .filter((o) => (o.orderStatus === 'CONFIRMED' || o.orderStatus === 'IN_PROGRESS') && toDateInputValue(o.eventDate) >= todayKey)
            .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
            .slice(0, 5)
            .map((o): UpcomingEvent => {
              const key = toDateInputValue(o.eventDate);
              return {
                day: Number(key.slice(8, 10)),
                month: `Tháng ${Number(key.slice(5, 7))}`,
                title: o.eventName ?? `Sự kiện ${o.customerName}`,
                time: formatTime(o.eventDate),
                venue: o.location,
                status: o.orderStatus,
              };
            }),
        );

        // ── Đơn gần đây ──
        setRecentOrders(
          [...orders]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 5)
            .map((o): RecentOrderRow => ({
              orderId: o.orderCode,
              customerName: o.customerName,
              eventDate: formatDate(o.eventDate),
              value: o.totalAmount,
              status: o.orderStatus,
              assignee: leadByOrder.get(o.orderId) ?? '—',
            })),
        );

        // ── Nhân sự đang trực (theo tải phân công) ──
        setStaffOnDuty(
          [...staffLoad.values()]
            .sort((a, b) => b.count - a.count)
            .slice(0, 6)
            .map((s): StaffOnDuty => {
              const status: StaffDutyStatus = s.count >= 3 ? 'busy' : s.count >= 1 ? 'processing' : 'off';
              return { name: s.name, eventsCount: s.count, ordersCount: s.count, status };
            }),
        );
      })
      .catch(() => {
        if (!cancelled) setLoadError('Không tải được dữ liệu tổng quan.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { isLoading, loadError, kpis, revenueTrend, orderStatusBreakdown, upcomingEvents, recentOrders, staffOnDuty };
}
