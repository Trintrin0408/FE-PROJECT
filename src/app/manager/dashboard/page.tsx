'use client';

import { AlertTriangle, CalendarClock, ClipboardCheck, ShoppingBag } from 'lucide-react';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import OrderStatusDonut from '@/components/dashboard/OrderStatusDonut';
import UpcomingEventsCard from '@/components/dashboard/UpcomingEventsCard';
import PendingConfirmationsCard from '@/components/dashboard/PendingConfirmationsCard';
import RecentOrdersCard from '@/components/dashboard/RecentOrdersCard';
import Reveal from '@/components/ui/Reveal';
import { useManagerDashboard } from '@/hooks/useManagerDashboard';

// Operational Dashboard của Manager — khác Administrative Dashboard của Admin (thiên về doanh
// thu/audit): tập trung trạng thái order/task/thanh toán/kho và hàng đợi chờ xác nhận (mục 1
// CLAUDE.md). Nối API thật 2026-08-03 qua useManagerDashboard() — không có endpoint /dashboard tổng
// hợp nào ở backend (xem comment đầu hook), nên toàn bộ số liệu ở đây tổng hợp từ nhiều API rời rạc đã
// xác nhận thật (order/survey/change-request/inventory/deposit/schedule-plan).
export default function ManagerDashboardPage() {
  const { isLoading, loadError, kpis, pendingConfirmations, orderStatusBreakdown, recentOrders, upcomingEvents } = useManagerDashboard();
  const totalOrders = orderStatusBreakdown.reduce((sum, slice) => sum + slice.count, 0);

  const items: KpiCardItem[] = [
    {
      label: 'Đơn đang xử lý',
      value: kpis.activeOrders,
      icon: ShoppingBag,
      iconColor: 'blue',
      changeLabel: kpis.activeOrdersChangeLabel,
      changeDirection: 'up',
      href: '/manager/orders',
    },
    {
      label: 'Chờ xác nhận',
      value: kpis.pendingConfirmations,
      icon: ClipboardCheck,
      iconColor: 'amber',
      changeLabel: 'Cần xử lý',
      changeDirection: 'up',
      // Không link ra màn riêng — danh sách chi tiết đã hiện ngay bên dưới trên cùng trang này (PendingConfirmationsCard).
    },
    {
      label: 'Việc cần làm hôm nay',
      value: kpis.tasksToday,
      icon: CalendarClock,
      iconColor: 'green',
      changeLabel: kpis.tasksTodayChangeLabel,
      changeDirection: 'up',
      href: '/manager/schedule/tasks',
    },
    {
      label: 'Cảnh báo tồn kho',
      value: kpis.inventoryAlerts,
      icon: AlertTriangle,
      iconColor: 'red',
      changeLabel: `Dưới ngưỡng an toàn`,
      changeDirection: 'down',
      href: '/manager/inventory/stock-check',
    },
  ];

  return (
    <div className="p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tổng quan</h1>
        <p className="mt-1 text-sm text-slate-500">Theo dõi trạng thái đơn hàng, công việc hiện trường và các mục chờ xác nhận.</p>
        {loadError && <p className="mt-1 text-xs text-red-500">{loadError}</p>}
      </div>

      <div className="mt-6">
        <DashboardStats items={items} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Reveal className="lg:col-span-2">
          <PendingConfirmationsCard items={pendingConfirmations} />
        </Reveal>
        <Reveal delay={0.05}>
          <OrderStatusDonut data={orderStatusBreakdown} total={totalOrders} viewDetailHref="/manager/orders" />
        </Reveal>
        <Reveal delay={0.1}>
          <UpcomingEventsCard events={upcomingEvents} viewAllHref="/manager/orders" />
        </Reveal>
      </div>

      <Reveal className="mt-6">
        <RecentOrdersCard orders={recentOrders} isLoading={isLoading} />
      </Reveal>
    </div>
  );
}
