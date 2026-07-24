import { FIELD_OPS_STAFF } from './employees';
import { REFERENCE_TODAY, createMockStore } from './utils';

// Nguồn Attendance (chấm công theo buổi) cho app staff-mobile — mô phỏng đúng luồng 2 lớp xác nhận ở
// mục 1 CLAUDE.md: Technical Staff tự check-in -> Leader Staff xác nhận điểm danh nhóm mình phụ trách
// -> Manager xác nhận tổng hợp cuối cùng (bước cuối chỉ xem trước trên mobile, thao tác xác nhận thật
// nằm ở web Manager — CHƯA có màn hình đó trong phạm vi task này). Đơn giản hóa: 1 đội field-ops duy
// nhất (FIELD_OPS_STAFF, db/employees.ts) do FIELD_OPS_STAFF[0] làm Leader phụ trách toàn bộ 4 người
// còn lại, khớp LEADER_STAFF_POOL đã dùng ở changeRequests.ts/schedulePlans.ts.

export type AttendanceStatus = 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'LEADER_CONFIRMED' | 'MANAGER_CONFIRMED';

export const ATTENDANCE_STATUS_META: Record<AttendanceStatus, { label: string; badgeClass: string }> = {
  NOT_CHECKED_IN: { label: 'Chưa check-in', badgeClass: 'bg-slate-100 text-slate-500' },
  CHECKED_IN: { label: 'Chờ Leader xác nhận', badgeClass: 'bg-amber-100 text-amber-700' },
  LEADER_CONFIRMED: { label: 'Chờ Manager xác nhận', badgeClass: 'bg-blue-100 text-blue-700' },
  MANAGER_CONFIRMED: { label: 'Đã chốt công', badgeClass: 'bg-emerald-100 text-emerald-700' },
};

export interface AttendanceRecord {
  id: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  session: string; // vd "Buổi thi công"
  checkInTime?: string; // HH:mm
  status: AttendanceStatus;
  leaderName?: string;
  leaderConfirmedAt?: string; // YYYY-MM-DD
  managerConfirmedAt?: string; // YYYY-MM-DD
}

/** Leader phụ trách chung cho toàn đội field-ops (đơn giản hóa 1 đội duy nhất cho demo mobile). */
export const TEAM_LEADER_NAME = FIELD_OPS_STAFF[0].name;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function generateSeed(): AttendanceRecord[] {
  const pastDays = [addDays(REFERENCE_TODAY, -2), addDays(REFERENCE_TODAY, -1)];
  const todayStatusPool: AttendanceStatus[] = ['MANAGER_CONFIRMED', 'LEADER_CONFIRMED', 'CHECKED_IN', 'NOT_CHECKED_IN', 'CHECKED_IN'];
  const records: AttendanceRecord[] = [];

  pastDays.forEach((date) => {
    FIELD_OPS_STAFF.forEach((staff, i) => {
      records.push({
        id: `CC-${staff.id}-${date}`,
        staffName: staff.name,
        date,
        session: 'Buổi thi công',
        checkInTime: `0${7 + (i % 2)}:${String(15 + i * 3).padStart(2, '0')}`,
        status: 'MANAGER_CONFIRMED',
        leaderName: TEAM_LEADER_NAME,
        leaderConfirmedAt: date,
        managerConfirmedAt: date,
      });
    });
  });

  FIELD_OPS_STAFF.forEach((staff, i) => {
    const status = staff.name === TEAM_LEADER_NAME ? 'LEADER_CONFIRMED' : todayStatusPool[i % todayStatusPool.length];
    records.push({
      id: `CC-${staff.id}-${REFERENCE_TODAY}`,
      staffName: staff.name,
      date: REFERENCE_TODAY,
      session: 'Buổi thi công',
      checkInTime: status === 'NOT_CHECKED_IN' ? undefined : `0${7 + (i % 2)}:${String(15 + i * 3).padStart(2, '0')}`,
      status,
      leaderName: status === 'LEADER_CONFIRMED' || status === 'MANAGER_CONFIRMED' ? TEAM_LEADER_NAME : undefined,
      leaderConfirmedAt: status === 'LEADER_CONFIRMED' || status === 'MANAGER_CONFIRMED' ? REFERENCE_TODAY : undefined,
      managerConfirmedAt: status === 'MANAGER_CONFIRMED' ? REFERENCE_TODAY : undefined,
    });
  });

  return records;
}

const store = createMockStore<AttendanceRecord>('attendance', generateSeed(), 'id');

export function getAttendanceForStaff(staffName: string): AttendanceRecord[] {
  return store
    .getAll()
    .filter((r) => r.staffName === staffName)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getTodayAttendanceForStaff(staffName: string): AttendanceRecord | undefined {
  return store.getAll().find((r) => r.staffName === staffName && r.date === REFERENCE_TODAY);
}

/** Technical/Leader Staff tự bấm check-in buổi hôm nay. */
export function checkInAttendance(staffName: string): void {
  const existing = getTodayAttendanceForStaff(staffName);
  const now = new Date().toTimeString().slice(0, 5);
  if (existing) {
    store.update(existing.id, { status: 'CHECKED_IN', checkInTime: now, leaderName: undefined, leaderConfirmedAt: undefined });
    return;
  }
  store.add({
    id: `CC-${staffName}-${REFERENCE_TODAY}-${Date.now().toString(36)}`,
    staffName,
    date: REFERENCE_TODAY,
    session: 'Buổi thi công',
    checkInTime: now,
    status: 'CHECKED_IN',
  });
}

/** Danh sách điểm danh của cả đội (trừ chính Leader) trong 1 ngày — dùng cho màn "Xác nhận điểm danh
 * nhóm" của Leader Staff. */
export function getTeamAttendanceForDate(date: string): AttendanceRecord[] {
  return store.getAll().filter((r) => r.date === date && r.staffName !== TEAM_LEADER_NAME);
}

export function leaderConfirmAttendance(id: string, leaderName: string): void {
  store.update(id, { status: 'LEADER_CONFIRMED', leaderName, leaderConfirmedAt: REFERENCE_TODAY });
}
