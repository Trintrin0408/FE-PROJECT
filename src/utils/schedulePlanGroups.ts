// Gom nhóm dữ liệu phẳng GET /schedule-plans thành "1 kế hoạch/1 đơn" cho màn "Kế hoạch và phân
// công" — DB thật không có khái niệm 1 kế hoạch = 1 bản ghi (xem docs/kehoachvaphancong_api.md mục 1),
// mỗi dòng schedule_plans là 1 order_id + 1 task_id riêng. Dùng chung cho cả 3 tab (Lịch điều phối/
// Lịch timeline/Danh sách kế hoạch) và PlanDetailDrawer/PlanFormDrawer — tránh lặp lại thuật toán ở
// 2 trang mirror (admin/coordination/planning, manager/schedule/plans).
import type { SchedulePlan, ScheduleStatus } from '@/types/schedulePlan';
import { computeOrderLockWindow } from './inventoryLock';
import { hashIndex } from './colorHash';

export interface OrderPlanGroup {
  orderId: string;
  orderCode: string;
  customerName: string;
  eventName: string;
  eventDate: string;
  endDate?: string | null;
  location: string;
  rows: SchedulePlan[]; // sắp xếp theo startTime tăng dần
}

export function groupPlansByOrder(plans: SchedulePlan[]): OrderPlanGroup[] {
  const map = new Map<string, OrderPlanGroup>();
  for (const p of plans) {
    let group = map.get(p.orderId);
    if (!group) {
      group = {
        orderId: p.orderId,
        orderCode: p.orderCode ?? p.orderId,
        customerName: p.customerName ?? '',
        eventName: p.eventName ?? '',
        eventDate: p.eventDate ?? p.startTime,
        endDate: p.orderEndDate ?? null,
        location: p.orderLocation ?? '',
        rows: [],
      };
      map.set(p.orderId, group);
    }
    group.rows.push(p);
  }
  for (const group of map.values()) {
    group.rows.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  return [...map.values()];
}

/** Thuật toán tổng hợp trạng thái đề xuất ở docs/kehoachvaphancong_api.md mục 7 — CHƯA được Backend/
 * Product xác nhận chính thức, chỉ là suy đoán hợp lý từ tập status các dòng cùng đơn. */
export function getGroupStatusInfo(rows: SchedulePlan[]): { label: string; badgeClass: string; dotColorClass: string } {
  const statuses = rows.map((r) => r.status);
  const active = statuses.filter((s) => s !== 'CANCELLED');

  if (active.length === 0 && statuses.length > 0) {
    return { label: 'Đã hủy', badgeClass: 'bg-slate-100 text-slate-500', dotColorClass: 'bg-slate-400' };
  }
  if (active.some((s) => s === 'IN_PROGRESS')) {
    return { label: 'Đang thực hiện', badgeClass: 'bg-blue-50 text-blue-700', dotColorClass: 'bg-blue-500' };
  }
  const hasConfirmed = active.some((s) => s === 'CONFIRMED');
  const hasCompleted = active.some((s) => s === 'COMPLETED');
  if (hasConfirmed && hasCompleted) {
    return { label: 'Đang thực hiện', badgeClass: 'bg-blue-50 text-blue-700', dotColorClass: 'bg-blue-500' };
  }
  if (active.length > 0 && active.every((s) => s === 'COMPLETED')) {
    return { label: 'Hoàn thành', badgeClass: 'bg-purple-50 text-purple-700', dotColorClass: 'bg-purple-500' };
  }
  if (active.length > 0 && active.every((s) => s === 'CONFIRMED')) {
    return { label: 'Đã chốt', badgeClass: 'bg-emerald-50 text-emerald-700', dotColorClass: 'bg-emerald-500' };
  }
  return { label: 'Chuẩn bị', badgeClass: 'bg-amber-50 text-amber-700', dotColorClass: 'bg-amber-500' };
}

/** Palette màu cố định (theo customerId) cho thanh timeline "Timeline đơn" ở MasterSchedule — mục đích
 * là để các đơn cùng 1 khách hàng luôn ra cùng 1 màu, khác khách ra màu khác (không liên quan trạng thái
 * kế hoạch — trạng thái vẫn hiển thị riêng qua chấm tròn dùng getGroupStatusInfo().dotColorClass). */
const CUSTOMER_COLOR_PALETTE = [
  'bg-blue-50 text-blue-700',
  'bg-amber-50 text-amber-700',
  'bg-emerald-50 text-emerald-700',
  'bg-violet-50 text-violet-700',
  'bg-rose-50 text-rose-700',
  'bg-cyan-50 text-cyan-700',
  'bg-fuchsia-50 text-fuchsia-700',
  'bg-lime-50 text-lime-700',
];

export function getCustomerColorClass(customerKey: string): string {
  return CUSTOMER_COLOR_PALETTE[hashIndex(customerKey || 'unknown', CUSTOMER_COLOR_PALETTE.length)];
}

/** Khoảng ngày khóa kho của 1 nhóm — sử dụng computeOrderLockWindow (tính từ order.eventDate/endDate và các schedulePlans SETUP/COLLECT có đệm ±6 tiếng). 
 * Trả về [lockFrom, lockUntil] dưới dạng mảng string (ISO format). Nếu lockUntil null, mặc định bằng lockFrom. */
export function getGroupMinMaxRange(group: OrderPlanGroup): [string, string] {
  const { lockFrom, lockUntil } = computeOrderLockWindow(
    { eventDate: group.eventDate, endDate: group.endDate },
    group.rows
  );
  return [new Date(lockFrom).toISOString(), new Date(lockUntil || lockFrom).toISOString()];
}

/** LEAD của dòng có start_time sớm nhất trong tập rows đang xét — dùng cho "Chỉ huy" (mục 3) và vai
 * trò hiển thị khi 1 người trùng ở nhiều dòng (mục 2.5). */
export function getEarliestRowLead(rows: SchedulePlan[]): string | undefined {
  if (rows.length === 0) return undefined;
  const earliest = [...rows].sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
  return earliest.assignees?.find((a) => a.role === 'LEAD')?.fullName;
}

/** true nếu nhóm còn ít nhất 1 dòng kế hoạch chưa bị hủy — đơn có nhóm nhưng toàn bộ dòng đã CANCELLED
 * vẫn cần coi như "chưa có kế hoạch" để chọn lại được ở PlanFormDrawer (Section 1). */
export function groupHasActivePlan(group: OrderPlanGroup): boolean {
  return group.rows.some((r) => r.status !== 'CANCELLED');
}

export function distinctAssigneeCount(rows: SchedulePlan[]): number {
  const ids = new Set<string>();
  for (const r of rows) for (const a of r.assignees ?? []) ids.add(a.userId);
  return ids.size;
}

export function unionAssignees(rows: SchedulePlan[]): { userId: string; fullName: string; role: 'LEAD' | 'TECHNICAL' }[] {
  const map = new Map<string, { userId: string; fullName: string; role: 'LEAD' | 'TECHNICAL' }>();
  // Ưu tiên vai trò của dòng có start_time sớm nhất nếu 1 người xuất hiện ở nhiều dòng (mục 2.5).
  const sorted = [...rows].sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (const r of sorted) {
    for (const a of r.assignees ?? []) {
      if (!map.has(a.userId)) map.set(a.userId, { userId: a.userId, fullName: a.fullName, role: a.role });
    }
  }
  return [...map.values()];
}

export const ROLE_LABEL: Record<'LEAD' | 'TECHNICAL', string> = {
  LEAD: 'Trưởng nhóm',
  TECHNICAL: 'Kỹ thuật viên',
};

export const SCHEDULE_STATUS_LABEL: Record<ScheduleStatus, string> = {
  PENDING: 'Chuẩn bị',
  CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const SCHEDULE_STATUS_BADGE: Record<ScheduleStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  CONFIRMED: 'bg-emerald-50 text-emerald-700',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-purple-50 text-purple-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};
