import { useEffect, useState } from 'react';
import { orderApiService } from '@/services/order.service';
import { surveyApiService } from '@/services/survey.service';
import { changeRequestApiService } from '@/services/changeRequest.service';
import { inventoryApiService } from '@/services/inventory.service';
import { paymentApiService } from '@/services/payment.service';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import { formatDate, formatTime, toDateInputValue } from '@/utils/formatDate';
import type { Order, OrderStatus } from '@/types/order';
import type { InventoryRow } from '@/types/inventory';
import type { CollectedEquipmentReport } from '@/types/collectedEquipmentReport';
import type { SurveyReportListItem, SurveyReportListMeta } from '@/types/survey';
import type { SchedulePlan } from '@/types/schedulePlan';
import type { OrderStatusSlice, PendingConfirmation, RecentOrderRow, UpcomingEvent } from '@/types/dashboard';

// Trang /manager/dashboard (Tổng quan) — không có endpoint /dashboard hay /reports tổng hợp nào ở
// backend thật (grep xuyên suốt D:\sep490-backend-api\src: 0 kết quả cho "dashboard"/"report"; module
// report.service.ts cũ ở FE gọi các endpoint không tồn tại, KHÔNG dùng được). Hook này tự tổng hợp toàn
// bộ KPI/danh sách bằng cách gọi song song các API rời rạc đã xác nhận thật (order/survey/change-
// request/inventory/deposit/schedule-plan).
//
// Cảnh báo tồn kho: chưa có ngưỡng nghiệp vụ chính thức nào (grep "threshold" ở backend ra 0 kết quả) —
// dùng chung ngưỡng giả định = 5 đã áp dụng ở src/app/admin/inventory/stock-status/page.tsx để nhất
// quán toàn site thay vì tự bịa số khác.
const LOW_STOCK_THRESHOLD = 5;

const STATUS_SLICE_META: { status: OrderStatus; countsKey: 'new' | 'confirmed' | 'inProgress' | 'completed' | 'cancelled'; label: string; color: string }[] = [
  { status: 'NEW', countsKey: 'new', label: 'Mới', color: '#94a3b8' },
  { status: 'CONFIRMED', countsKey: 'confirmed', label: 'Xác nhận', color: '#3b82f6' },
  { status: 'IN_PROGRESS', countsKey: 'inProgress', label: 'Đang làm', color: '#f97316' },
  { status: 'COMPLETED', countsKey: 'completed', label: 'Hoàn thành', color: '#22c55e' },
  { status: 'CANCELLED', countsKey: 'cancelled', label: 'Đã hủy', color: '#ef4444' },
];

export interface ManagerDashboardKpis {
  activeOrders: number;
  activeOrdersChangeLabel: string;
  pendingConfirmations: number;
  tasksToday: number;
  tasksTodayChangeLabel: string;
  inventoryAlerts: number;
}

export interface ManagerDashboardData {
  isLoading: boolean;
  loadError: string | null;
  kpis: ManagerDashboardKpis;
  pendingConfirmations: PendingConfirmation[];
  orderStatusBreakdown: OrderStatusSlice[];
  recentOrders: RecentOrderRow[];
  upcomingEvents: UpcomingEvent[];
}

const EMPTY_KPIS: ManagerDashboardKpis = {
  activeOrders: 0,
  activeOrdersChangeLabel: '',
  pendingConfirmations: 0,
  tasksToday: 0,
  tasksTodayChangeLabel: '',
  inventoryAlerts: 0,
};

export function useManagerDashboard(): ManagerDashboardData {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<ManagerDashboardKpis>(EMPTY_KPIS);
  const [pendingConfirmations, setPendingConfirmations] = useState<PendingConfirmation[]>([]);
  const [orderStatusBreakdown, setOrderStatusBreakdown] = useState<OrderStatusSlice[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrderRow[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    const today = toDateInputValue(Date.now());
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const nowISO = new Date().toISOString();

    Promise.all([
      // Nguồn chính (đơn đang xử lý/donut trạng thái/đơn gần đây/sự kiện sắp tới) — meta.counts đã là số
      // liệu toàn hệ thống (không bị giới hạn bởi limit), riêng `data` (tối đa 100 đơn tạo gần nhất) chỉ
      // đủ dùng cho "đơn gần đây"/"sự kiện sắp tới" ở quy mô hiện tại (backend giới hạn limit tối đa 100).
      orderApiService.getOrders({ limit: 100 }),
      surveyApiService.getSurveyReports({ limit: 1 }).catch(() => null) as Promise<{ data: SurveyReportListItem[]; meta: SurveyReportListMeta } | null>,
      changeRequestApiService.getChangeRequests({ status: 'pending', limit: 1 }).catch(() => null),
      inventoryApiService.getReturnReports({ status: 'SUBMITTED', limit: 100 }).catch(() => null) as Promise<{ data: CollectedEquipmentReport[] } | null>,
      paymentApiService.getDeposits({ status: 'UNPAID', limit: 1 }).catch(() => null),
      schedulePlanApiService
        .getSchedulePlans({ dateFrom: today, dateTo: today, dateMode: 'plan', limit: 200 })
        .catch(() => null) as Promise<{ data: SchedulePlan[] } | null>,
      inventoryApiService.getInventory({ limit: 200 }).catch(() => null) as Promise<{ data: InventoryRow[] } | null>,
    ])
      .then(([ordersRes, surveyRes, changeRequestRes, returnReportsRes, depositsRes, schedulePlansRes, inventoryRes]) => {
        if (cancelled) return;

        const orders: Order[] = ordersRes.data ?? [];
        const counts = ordersRes.meta?.counts;

        setOrderStatusBreakdown(
          STATUS_SLICE_META.map(({ status, countsKey, label, color }) => ({
            label,
            color,
            count: counts ? counts[countsKey] : orders.filter((o) => o.orderStatus === status).length,
          })),
        );

        setRecentOrders(
          orders.slice(0, 4).map((o) => ({
            orderId: o.orderCode,
            customerName: o.customerName,
            eventDate: formatDate(o.eventDate),
            value: o.totalAmount,
            status: o.orderStatus,
            assignee: o.createdBy?.fullName ?? '—',
          })),
        );

        setUpcomingEvents(
          orders
            .filter((o) => (o.orderStatus === 'CONFIRMED' || o.orderStatus === 'IN_PROGRESS') && o.eventDate >= nowISO)
            .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
            .slice(0, 5)
            .map((o) => {
              const [, monthStr, dayStr] = toDateInputValue(o.eventDate).split('-');
              return {
                day: Number(dayStr),
                month: `Tháng ${Number(monthStr)}`,
                title: o.eventName || `${o.eventType} — ${o.customerName}`,
                time: formatTime(o.eventDate),
                venue: o.location,
                status: o.orderStatus,
              };
            }),
        );

        const surveyPending = surveyRes ? (surveyRes.meta?.counts?.needsReview ?? 0) + (surveyRes.meta?.counts?.submitted ?? 0) : 0;
        const changeRequestPending = changeRequestRes?.meta?.totalItems ?? 0;
        // return-reports không lọc được reportType ở tầng API — đếm khớp đúng những gì trang
        // /manager/inventory/returns thật sự hiển thị (chỉ INTERNAL, SUPPLIER thuộc luồng khác).
        const returnReportsPending = returnReportsRes ? returnReportsRes.data.filter((r) => r.reportType === 'INTERNAL').length : 0;
        const depositsPending = depositsRes?.meta?.totalItems ?? 0;

        setPendingConfirmations([
          {
            type: 'survey',
            label: 'Báo cáo khảo sát',
            description: 'Khảo sát viên đã nộp, chờ duyệt để lập báo giá',
            count: surveyPending,
            href: '/manager/survey',
          },
          {
            type: 'deposit',
            label: 'Đặt cọc chưa xác nhận',
            description: 'Chưa xác nhận đã nhận tiền cọc từ khách hàng',
            count: depositsPending,
            href: '/manager/payments/deposits',
          },
          // {
          //   type: 'change_request',
          //   label: 'Yêu cầu thay đổi hiện trường',
          //   description: 'Thêm/bớt/đổi thiết bị tại hiện trường, chờ duyệt',
          //   count: changeRequestPending,
          //   href: '/manager/field-ops/change-requests',
          // },
          {
            type: 'inventory_return',
            label: 'Thu hồi & hỏng/mất thiết bị',
            description: 'Chờ xác nhận sau khi thu hồi thiết bị từ hiện trường',
            count: returnReportsPending,
            href: '/manager/inventory/returns',
          },
        ]);

        const schedulePlansToday = (schedulePlansRes?.data ?? []).filter((p) => p.status !== 'CANCELLED');
        const distinctOrders = new Set(schedulePlansToday.map((p) => p.orderId)).size;

        const inventoryRows: InventoryRow[] = inventoryRes?.data ?? [];
        const lowStockCount = inventoryRows.filter((r) => r.quantityAvailable < LOW_STOCK_THRESHOLD).length;

        const recentOrdersCount = orders.filter((o) => o.createdAt >= sevenDaysAgo).length;

        setKpis({
          activeOrders: (counts?.confirmed ?? 0) + (counts?.inProgress ?? 0),
          activeOrdersChangeLabel: `+${recentOrdersCount} tuần này`,
          pendingConfirmations: surveyPending + changeRequestPending + returnReportsPending + depositsPending,
          tasksToday: schedulePlansToday.length,
          tasksTodayChangeLabel: `${distinctOrders} đơn hiện trường`,
          inventoryAlerts: lowStockCount,
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError('Không tải được dữ liệu tổng quan. Vui lòng thử lại.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { isLoading, loadError, kpis, pendingConfirmations, orderStatusBreakdown, recentOrders, upcomingEvents };
}
