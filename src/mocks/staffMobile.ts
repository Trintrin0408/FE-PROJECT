import { getAllAdminWorkTasks, type FlatWorkTask } from './db/schedulePlans';
import { REFERENCE_TODAY } from './db/utils';

// Lớp truy vấn dữ liệu riêng cho app staff-mobile (Leader/Technical Staff) — tương tự
// adminDashboard.ts/managerDashboard.ts: KHÔNG tự tạo store mới, chỉ lọc/derive lại từ nguồn
// SchedulePlan/PlanWorkTask DUY NHẤT ở db/schedulePlans.ts theo đúng người đang đăng nhập (so khớp
// PlanWorkTask.assignee/team với AuthUser.fullName — 2 tài khoản mock 'leader'/'nhanvien' trong
// src/mocks/authAccounts.ts cố tình đặt fullName trùng FIELD_OPS_STAFF[0]/[1] để có dữ liệu thật).

/** Toàn bộ công việc có liên quan tới 1 nhân sự hiện trường — được giao chính (assignee) hoặc là
 * thành viên hỗ trợ (team). */
export function getTasksForStaff(staffName: string): FlatWorkTask[] {
  return getAllAdminWorkTasks().filter((t) => t.assignee === staffName || t.team.includes(staffName));
}

/** Công việc gần nhất (theo thời gian bắt đầu dự kiến) chưa hoàn thành — hiện ở thẻ "Việc tiếp theo"
 * trên Trang chủ. */
export function getNextTaskForStaff(staffName: string): FlatWorkTask | undefined {
  return getTasksForStaff(staffName)
    .filter((t) => t.status !== 'COMPLETED')
    .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
}

export interface StaffTaskStats {
  total: number;
  todo: number;
  inProgress: number;
  completed: number;
}

export function getTaskStatsForStaff(staffName: string): StaffTaskStats {
  const tasks = getTasksForStaff(staffName);
  return {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === 'TODO' || t.status === 'ASSIGNED').length,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    completed: tasks.filter((t) => t.status === 'COMPLETED').length,
  };
}

/** Nhóm công việc theo ngày (YYYY-MM-DD, tách từ startTime "YYYY-MM-DD HH:mm") — dùng cho trang Lịch
 * làm việc, sắp xếp ngày gần REFERENCE_TODAY nhất lên trước. */
export function groupTasksByDate(tasks: FlatWorkTask[]): { date: string; tasks: FlatWorkTask[] }[] {
  const map = new Map<string, FlatWorkTask[]>();
  tasks.forEach((t) => {
    const date = t.startTime.slice(0, 10);
    const list = map.get(date) ?? [];
    list.push(t);
    map.set(date, list);
  });
  return Array.from(map.entries())
    .map(([date, list]) => ({ date, tasks: list.sort((a, b) => a.startTime.localeCompare(b.startTime)) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Danh sách đơn hàng (rút gọn) mà nhân sự này đang có công việc liên quan — nguồn chọn đơn khi Leader
 * Staff tạo biên bản/Change Request mới tại hiện trường (không cần gõ lại orderId thủ công). */
export function getOrderOptionsForStaff(staffName: string): { orderId: string; customerName: string; eventName: string; location: string }[] {
  const seen = new Map<string, { orderId: string; customerName: string; eventName: string; location: string }>();
  getTasksForStaff(staffName).forEach((t) => {
    if (!seen.has(t.orderId)) {
      seen.set(t.orderId, { orderId: t.orderId, customerName: t.customerName, eventName: t.eventName, location: t.location });
    }
  });
  return Array.from(seen.values());
}

/** "Hôm nay" cố định của hệ mock (khớp REFERENCE_TODAY toàn dự án) — export lại để trang staff-mobile
 * không phải import trực tiếp từ db/utils. */
export { REFERENCE_TODAY };
