import type { Order } from '@/types/order';
import type { SchedulePlan } from '@/types/schedulePlan';
import { daysUntil } from '@/utils/eventDate';

// Nguồn cảnh báo "sắp diễn ra" cho chuông thông báo Header — gộp mốc "ngày tổ chức sự kiện"
// (Order.eventDate) LẪN mốc hiện trường của SchedulePlan liên quan (startTime). Trước đây đọc từ
// mock `mocks/db/approachingEvents.ts` (orderId không khớp Order thật từ orderApiService, dẫn tới
// link "xem chi tiết" trỏ sai đơn) — nay tính trực tiếp từ dữ liệu Order/SchedulePlan thật do
// caller đã fetch qua orderApiService/schedulePlanApiService.

export interface ApproachingEvent {
  orderId: string;
  customerName: string;
  venue: string;
  label: string;
  date: string;
  daysLeft: number;
}

/** Đơn "đã kết thúc vòng đời" (Hủy/Hoàn thành) không cần cảnh báo dù ngày còn gần. */
function isOrderActive(status: Order['orderStatus']): boolean {
  return status !== 'CANCELLED' && status !== 'COMPLETED';
}

/** Toàn bộ mốc thời gian (ngày tổ chức + hoạt động hiện trường) còn ≤withinDays ngày, gần nhất
 * trước. `referenceDate` dạng YYYY-MM-DD, mặc định hôm nay thật (không dùng mock "hôm nay" như
 * trước, vì dữ liệu nguồn giờ là dữ liệu thật từ backend). */
export function computeApproachingEvents(
  orders: Order[],
  schedulePlans: SchedulePlan[],
  withinDays = 7,
  referenceDate: string = new Date().toISOString().slice(0, 10),
): ApproachingEvent[] {
  const events: ApproachingEvent[] = [];

  for (const order of orders) {
    if (!isOrderActive(order.orderStatus)) continue;
    const daysLeft = daysUntil(order.eventDate.slice(0, 10), referenceDate);
    if (daysLeft >= 0 && daysLeft <= withinDays) {
      events.push({
        orderId: order.orderId,
        customerName: order.customerName,
        venue: order.location,
        label: 'Tổ chức sự kiện',
        date: order.eventDate,
        daysLeft,
      });
    }
  }

  const activeOrderIds = new Set(orders.filter((o) => isOrderActive(o.orderStatus)).map((o) => o.orderId));
  for (const plan of schedulePlans) {
    if (plan.status === 'CANCELLED') continue;
    if (!activeOrderIds.has(plan.orderId)) continue;
    if (!plan.startTime) continue;
    const daysLeft = daysUntil(plan.startTime.slice(0, 10), referenceDate);
    if (daysLeft >= 0 && daysLeft <= withinDays) {
      events.push({
        orderId: plan.orderId,
        customerName: plan.customerName ?? '',
        venue: plan.location ?? plan.orderLocation ?? '',
        label: plan.taskName ?? 'Công việc',
        date: plan.startTime,
        daysLeft,
      });
    }
  }

  return events.sort((a, b) => a.daysLeft - b.daysLeft);
}
