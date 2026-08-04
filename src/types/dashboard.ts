// Shape dùng chung cho các card trình bày ở trang "Tổng quan" (Admin lẫn Manager) — tách riêng khỏi
// src/mocks/adminDashboard.ts để trang /manager/dashboard có thể nối API thật (src/hooks/
// useManagerDashboard.ts) mà không phải phụ thuộc vào module mock (adminDashboard.ts vẫn giữ nguyên
// cho /admin/dashboard — backend dashboard/report tổng hợp thật sự không tồn tại, xem comment đầu file
// đó). Các component trình bày (OrderStatusDonut, UpcomingEventsCard, RecentOrdersCard,
// PendingConfirmationsCard) import type từ đây thay vì từ mocks/*.
import type { OrderStatus } from '@/types/order';

export interface OrderStatusSlice {
  label: string;
  count: number;
  color: string;
}

export interface UpcomingEvent {
  day: number;
  month: string;
  title: string;
  time: string;
  venue: string;
  status: OrderStatus;
}

export interface RecentOrderRow {
  orderId: string;
  customerName: string;
  eventDate: string;
  value: number;
  status: OrderStatus;
  assignee: string;
}

export type ConfirmationType = 'survey' | 'change_request' | 'inventory_return' | 'deposit';

export interface PendingConfirmation {
  type: ConfirmationType;
  label: string;
  description: string;
  count: number;
  href: string;
}
