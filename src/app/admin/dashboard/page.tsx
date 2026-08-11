'use client';

import { DollarSign, ShoppingCart, FileText, Users } from 'lucide-react';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import RevenueChart from '@/components/reports/RevenueChart';
import OrderStatusDonut from '@/components/dashboard/OrderStatusDonut';
import UpcomingEventsCard from '@/components/dashboard/UpcomingEventsCard';
import RecentOrdersCard from '@/components/dashboard/RecentOrdersCard';
import StaffOnDutyCard from '@/components/dashboard/StaffOnDutyCard';
import Reveal from '@/components/ui/Reveal';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { formatCurrency } from '@/utils/formatCurrency';

// Administrative Dashboard (Admin) — tổng hợp dữ liệu THẬT client-side (không có endpoint /dashboard/admin
// hay /reports/revenue: đều 404). Nguồn: /orders (+meta.counts), /quotations, /customers, /schedule-plans.
export default function Page() {
  const { isLoading, loadError, kpis, revenueTrend, orderStatusBreakdown, upcomingEvents, recentOrders, staffOnDuty } =
    useAdminDashboard();
  const totalOrders = orderStatusBreakdown.reduce((sum, slice) => sum + slice.count, 0);

  const items: KpiCardItem[] = [
    {
      label: 'Doanh thu tháng',
      value: formatCurrency(kpis.monthlyRevenue),
      icon: DollarSign,
      iconColor: 'blue',
      changeLabel: kpis.monthlyRevenueChangeLabel,
      changeDirection: kpis.monthlyRevenueChangeDirection,
      href: '/admin/reports/revenue',
    },
    {
      label: 'Đơn đặt mới (tháng)',
      value: kpis.newOrders,
      icon: ShoppingCart,
      iconColor: 'green',
      changeLabel: kpis.newOrdersChangeLabel,
      changeDirection: kpis.newOrdersChangeDirection,
      href: '/admin/orders_audit',
    },
    {
      label: 'Báo giá chờ duyệt',
      value: kpis.pendingQuotations,
      icon: FileText,
      iconColor: 'amber',
      changeLabel: 'Bản nháp chưa duyệt',
      changeDirection: 'up',
      href: '/admin/quotations',
    },
    {
      label: 'Khách hàng mới',
      value: kpis.newCustomers,
      icon: Users,
      iconColor: 'pink',
      changeLabel: kpis.newCustomersChangeLabel,
      changeDirection: kpis.newCustomersChangeDirection,
      href: '/admin/customers',
    },
  ];

  return (
    <div className="p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tổng quan</h1>
        <p className="mt-1 text-sm text-slate-500">Theo dõi hoạt động kinh doanh và vận hành dịch vụ tiệc cưới.</p>
      </div>

      {loadError ? (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{loadError}</div>
      ) : (
        <>
          <div className="mt-6">
            <DashboardStats items={items} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-4">
            <Reveal className="lg:col-span-2">
              <RevenueChart data={revenueTrend} />
            </Reveal>
            <Reveal delay={0.05}>
              <OrderStatusDonut data={orderStatusBreakdown} total={totalOrders} />
            </Reveal>
            <Reveal delay={0.1}>
              <UpcomingEventsCard events={upcomingEvents} />
            </Reveal>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Reveal className="lg:col-span-2">
              <RecentOrdersCard orders={recentOrders} />
            </Reveal>
            <Reveal delay={0.05}>
              <StaffOnDutyCard staff={staffOnDuty} />
            </Reveal>
          </div>

          {isLoading && <p className="mt-4 text-xs text-slate-400">Đang tải dữ liệu tổng quan…</p>}
        </>
      )}
    </div>
  );
}
