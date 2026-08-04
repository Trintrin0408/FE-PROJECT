import type { RevenueReportPoint } from '@/types/report';
import type { OrderStatus } from '@/types/order';
import type { OrderStatusSlice, RecentOrderRow, UpcomingEvent } from '@/types/dashboard';
import { getAdminOrders, REFERENCE_TODAY } from '@/mocks/db/orders';
import { getAdminQuotations } from '@/mocks/db/quotations';
import { getOrderPaymentViews, type OrderPaymentView } from '@/mocks/db/payments';
import { FIELD_OPS_STAFF } from '@/mocks/db/employees';

// Backend hiện không gọi được (Network Error, xem docs/more-require.md mục (jj)) — trong giai đoạn
// tập trung thiết kế giao diện thuần, trang /admin/dashboard dùng dữ liệu ảo cố định dưới đây thay
// vì gọi reportApiService. Khôi phục lại API thật khi backend hoạt động bình thường trở lại.
//
// Trạng thái đơn đặt dùng đúng enum OrderStatus thật (5 giá trị, xem constants/order-status.ts) để
// đồng bộ với trang danh sách/chi tiết đơn đặt — không tự bịa thêm trạng thái riêng cho dashboard.
//
// DEMO_CHECKLIST.md Task 14: newOrders, MOCK_ORDER_STATUS_BREAKDOWN, MOCK_RECENT_ORDERS tính TỪ
// src/mocks/db/orders.ts (nguồn Order thật, dùng chung với /admin/orders_audit) thay vì số liệu tĩnh
// riêng — tạo/xóa/đổi trạng thái đơn ở trang Đơn đặt sẽ phản ánh lại đúng ở đây khi vào lại trang.
// DEMO_CHECKLIST.md Task 21: monthlyRevenue, pendingQuotations, MOCK_REVENUE_TREND (giờ
// getRevenueTrend()), MOCK_UPCOMING_EVENTS (giờ getUpcomingEvents()), MOCK_STAFF_ON_DUTY (giờ
// getStaffOnDuty()) tính TỪ db/orders.ts + db/quotations.ts + db/payments.ts + db/employees.ts.
// newCustomers vẫn tĩnh — `AdminCustomer` (db/customers.ts) chưa có field `createdAt` nên không có
// cách xác định khách "mới trong tháng" từ dữ liệu thật; các badge *Change (% so với tháng trước)
// cũng vẫn tĩnh vì mock không lưu số liệu kỳ trước để tính chênh lệch thật.

// "Hôm nay" cố định của toàn bộ hệ mock — nhập từ db/orders.ts (nguồn duy nhất, khớp giá trị
// `today` hardcode trong `generateMockOrders()`) để mọi phép tính theo tháng/ngày ở đây nhất quán
// với ngày tạo sinh dữ liệu đơn hàng/thanh toán, không dùng `new Date()` thật của trình duyệt.
const REFERENCE_MONTH_KEY = REFERENCE_TODAY.slice(0, 7); // "2026-07"

function monthKeyOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** Số tiền thực đã thu của 1 đơn kèm ngày ghi nhận — khớp đúng công thức `paidAmount` đã dùng ở
 * trang chi tiết "Đặt cọc" (`admin/orders_audit/payments/[id]`) và "Thanh toán"
 * (`admin/orders_audit/settlements/[id]`): đã quyết toán thì tính
 * đủ giá trị đơn (ghi nhận vào ngày quyết toán `settlementSettledAt`), chưa quyết toán thì chỉ tính
 * cọc đã nhận (ghi nhận vào ngày nhận cọc `depositPaymentDate`), chưa cọc thì không có doanh thu.
 * Dùng ngày THU TIỀN thật thay vì `eventDate` (ngày tổ chức sự kiện) — vì đơn hàng có thể tổ chức ở
 * tháng khác hẳn tháng thu tiền (cọc thường thu trước sự kiện nhiều tuần/tháng), lấy theo eventDate
 * sẽ ra doanh thu tháng hiện tại luôn bằng 0 (không có đơn nào vừa tổ chức vừa đã quyết toán xong
 * ngay trong cùng tháng ở seed hiện tại). */
function collectedRevenueOf(view: OrderPaymentView): { amount: number; date: string } | null {
  if (view.settlementStatus === 'SETTLED' && view.settlementSettledAt) {
    return { amount: view.totalValue, date: view.settlementSettledAt };
  }
  if (view.depositStatus === 'RECEIVED' && view.depositPaymentDate) {
    return { amount: view.depositAmount, date: view.depositPaymentDate };
  }
  return null;
}

export function getAdminDashboardKpis() {
  const revenues = getOrderPaymentViews().map(collectedRevenueOf).filter((r): r is { amount: number; date: string } => r !== null);
  const monthlyRevenue = revenues.filter((r) => monthKeyOf(r.date) === REFERENCE_MONTH_KEY).reduce((sum, r) => sum + r.amount, 0);
  const pendingQuotations = getAdminQuotations().filter((q) => q.status === 'draft' || q.status === 'surveying').length;

  return {
    monthlyRevenue,
    monthlyRevenueChange: '+18.6%',
    newOrders: getAdminOrders().filter((o) => o.status === 'NEW').length,
    newOrdersChange: '+21.2%',
    pendingQuotations,
    pendingQuotationsChange: '+12.5%',
    newCustomers: 36,
    newCustomersChange: '+20.0%',
  };
}

/** 6 tháng gần nhất tính tới REFERENCE_TODAY, doanh thu tính giống `monthlyRevenue` ở trên (theo ngày
 * thu tiền thật) nhưng theo từng tháng — thay cho `MOCK_REVENUE_TREND` tĩnh trước đây (Task 21). */
export function getRevenueTrend(): RevenueReportPoint[] {
  const revenues = getOrderPaymentViews().map(collectedRevenueOf).filter((r): r is { amount: number; date: string } => r !== null);
  const [refYear, refMonth] = REFERENCE_TODAY.split('-').map(Number);
  const months = Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i;
    const d = new Date(refYear, refMonth - 1 - offset, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${d.getMonth() + 1}/${d.getFullYear()}` };
  });

  return months.map(({ key, label }) => ({
    month: label,
    revenue: revenues.filter((r) => monthKeyOf(r.date) === key).reduce((sum, r) => sum + r.amount, 0),
  }));
}

const STATUS_SLICE_META: { status: OrderStatus; label: string; color: string }[] = [
  { status: 'NEW', label: 'Mới', color: '#94a3b8' },
  { status: 'CONFIRMED', label: 'Xác nhận', color: '#3b82f6' },
  { status: 'IN_PROGRESS', label: 'Đang làm', color: '#f97316' },
  { status: 'COMPLETED', label: 'Hoàn thành', color: '#22c55e' },
  { status: 'CANCELLED', label: 'Đã hủy', color: '#ef4444' },
];

export function getOrderStatusBreakdown(): OrderStatusSlice[] {
  const orders = getAdminOrders();
  return STATUS_SLICE_META.map(({ status, label, color }) => ({
    label,
    color,
    count: orders.filter((o) => o.status === status).length,
  }));
}

/** Đơn đặt sắp diễn ra (CONFIRMED/IN_PROGRESS, từ REFERENCE_TODAY trở đi), gần nhất trước — thay cho
 * `MOCK_UPCOMING_EVENTS` tĩnh trước đây (Task 21). Giờ tổ chức lấy cố định "17:30" — khớp khung giờ
 * sự kiện chuẩn đã dùng ở `getAdminOrderDetail()` (db/orders.ts: "17:30 - 22:00"), vì `AdminOrderRow`
 * chưa có field giờ tổ chức riêng. */
export function getUpcomingEvents(limit = 5): UpcomingEvent[] {
  return getAdminOrders()
    .filter((o) => (o.status === 'CONFIRMED' || o.status === 'IN_PROGRESS') && o.weddingDate >= REFERENCE_TODAY)
    .sort((a, b) => a.weddingDate.localeCompare(b.weddingDate))
    .slice(0, limit)
    .map((o) => {
      const [, month, day] = o.weddingDate.split('-');
      return {
        day: Number(day),
        month: `Tháng ${Number(month)}`,
        title: `Lễ cưới ${o.customerName}`,
        time: '17:30',
        venue: o.venue,
        status: o.status,
      };
    });
}

export function getRecentOrders(limit = 4): RecentOrderRow[] {
  return [...getAdminOrders()]
    .sort((a, b) => b.weddingDate.localeCompare(a.weddingDate))
    .slice(0, limit)
    .map((o) => ({
      orderId: o.orderId,
      customerName: o.customerName,
      eventDate: o.weddingDate.split('-').reverse().join('/'),
      value: o.totalPrice,
      status: o.status,
      assignee: o.coordinatorName,
    }));
}

export type StaffDutyStatus = 'busy' | 'processing' | 'off';

export interface StaffOnDuty {
  name: string;
  eventsCount: number;
  ordersCount: number;
  status: StaffDutyStatus;
}

/** 5 nhân sự đội hiện trường (FIELD_OPS_STAFF, db/employees.ts) đối chiếu với số đơn đang phụ trách
 * (CONFIRMED/IN_PROGRESS, khớp `coordinatorName`) — thay cho `MOCK_STAFF_ON_DUTY` tĩnh trước đây
 * (Task 21). `eventsCount`/`ordersCount` dùng chung 1 số đếm vì trong mô hình hiện tại 1 đơn = 1 sự
 * kiện, không có khái niệm tách biệt 2 con số này ở dữ liệu thật. */
export function getStaffOnDuty(): StaffOnDuty[] {
  const activeOrders = getAdminOrders().filter((o) => o.status === 'CONFIRMED' || o.status === 'IN_PROGRESS');
  return FIELD_OPS_STAFF.map((staff) => {
    const count = activeOrders.filter((o) => o.coordinatorName === staff.name).length;
    const status: StaffDutyStatus = count >= 2 ? 'busy' : count === 1 ? 'processing' : 'off';
    return { name: staff.name, eventsCount: count, ordersCount: count, status };
  });
}
