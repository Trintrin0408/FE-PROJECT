// Lớp tính toán dùng chung cho trang "Lịch tổng thể" (Master Schedule) — gom mọi phép tính ngày/giờ,
// mức bận (capacity), phát hiện trùng lịch nhân sự và trích xuất thời gian thiết bị đi/về, để các view
// (heatmap, lịch sự kiện, lịch nhân sự, thiết bị đi/về) chỉ lo phần hiển thị.
//
// NGUYÊN TẮC MÚI GIỜ: mọi hiển thị của site quy về giờ Việt Nam (VN_TIME_ZONE) — xem utils/formatDate.
//  - Phép tính THUẦN NGÀY (lưới tháng, so ngày) chạy trên chuỗi 'YYYY-MM-DD' + parse ở UTC-12h (giữa
//    trưa) để không bị lệch ±1 ngày do đổi timezone.
//  - Phép tính CÓ GIỜ (vị trí trên trục giờ, phát hiện trùng) chạy trên epoch ms thật của startTime/
//    endTime, còn khi cần "giờ:phút hiển thị" thì lấy theo VN_TIME_ZONE để khớp formatTime.
import type { Order, OrderStatus } from '@/types/order';
import type { SchedulePlan } from '@/types/schedulePlan';
import { VN_TIME_ZONE, toDateInputValue } from './formatDate';

export const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export const MONTH_LABEL = (month0: number) => `Tháng ${month0 + 1}`;

// ---------------------------------------------------------------------------
// Phép tính thuần ngày (chuỗi 'YYYY-MM-DD')
// ---------------------------------------------------------------------------

/** Chuỗi ngày VN ('YYYY-MM-DD') của 1 mốc ISO/epoch — dùng chung cho gom nhóm theo ngày. */
export function vnDateKey(value: string | number): string {
  return toDateInputValue(value);
}

/** Parse 'YYYY-MM-DD' ở UTC giữa trưa (12:00Z) — tránh lệch ngày khi getUTCDay()/cộng ngày. */
function parseKeyNoon(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

export function addDaysKey(key: string, days: number): string {
  const d = parseKeyNoon(key);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Thứ trong tuần bắt đầu từ T2 (0=T2 ... 6=CN). */
export function weekdayIndex(key: string): number {
  return (parseKeyNoon(key).getUTCDay() + 6) % 7;
}

export function weekdayLabel(key: string): string {
  return WEEKDAY_LABELS[weekdayIndex(key)];
}

export function dayOfMonth(key: string): number {
  return parseKeyNoon(key).getUTCDate();
}

/** Số ngày lịch giữa 2 key (b - a). */
export function diffDaysKey(a: string, b: string): number {
  return Math.round((parseKeyNoon(b).getTime() - parseKeyNoon(a).getTime()) / 86_400_000);
}

/** Danh sách key ngày liên tục [fromKey, toKey] (bao gồm 2 đầu). Giới hạn an toàn 400 ngày. */
export function enumerateDayKeys(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let cur = fromKey;
  for (let i = 0; i < 400 && cur <= toKey; i += 1) {
    out.push(cur);
    cur = addDaysKey(cur, 1);
  }
  return out;
}

/** Key thứ Hai của tuần chứa `key` (tuần bắt đầu T2). */
export function weekStartKey(key: string): string {
  return addDaysKey(key, -weekdayIndex(key));
}

export interface MonthDayCell {
  key: string; // 'YYYY-MM-DD'
  day: number; // ngày trong tháng
  inMonth: boolean; // thuộc tháng đang xem hay tràn tháng kề
  isToday: boolean;
  weekend: boolean;
}

/** Lưới tháng 6 hàng × 7 cột (tuần bắt đầu T2), gồm ngày tràn của tháng trước/sau để lấp đầy. */
export function getMonthMatrix(year: number, month0: number, todayKey: string): MonthDayCell[][] {
  const firstKey = `${year}-${String(month0 + 1).padStart(2, '0')}-01`;
  const startOffset = weekdayIndex(firstKey); // số ô trống trước ngày 1
  const gridStart = addDaysKey(firstKey, -startOffset);
  const weeks: MonthDayCell[][] = [];
  for (let w = 0; w < 6; w += 1) {
    const row: MonthDayCell[] = [];
    for (let d = 0; d < 7; d += 1) {
      const key = addDaysKey(gridStart, w * 7 + d);
      const nd = parseKeyNoon(key);
      row.push({
        key,
        day: nd.getUTCDate(),
        inMonth: nd.getUTCMonth() === month0 && nd.getUTCFullYear() === year,
        isToday: key === todayKey,
        weekend: d >= 5,
      });
    }
    weeks.push(row);
  }
  return weeks;
}

/** Key ngày "hôm nay" theo giờ VN. */
export function todayKeyVN(): string {
  return toDateInputValue(Date.now());
}

// ---------------------------------------------------------------------------
// Phép tính có giờ (trục giờ, trùng lịch)
// ---------------------------------------------------------------------------

/** Giờ thập phân theo giờ VN (vd 16:53 -> 16.883). Dùng đặt vị trí trên trục giờ. */
export function vnHourFloat(value: string | number): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VN_TIME_ZONE,
  }).formatToParts(new Date(value));
  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  // Intl có thể trả '24' cho nửa đêm ở một số môi trường — quy về 0.
  return (hh % 24) + mm / 60;
}

// ---------------------------------------------------------------------------
// Màu theo trạng thái đơn (dùng cho block lịch)
// ---------------------------------------------------------------------------

export interface StatusStyle {
  label: string;
  bar: string; // nền thanh + chữ
  dot: string; // chấm tròn
  soft: string; // nền nhạt cho ô/hover
}

export const ORDER_STATUS_STYLE: Record<OrderStatus, StatusStyle> = {
  NEW: { label: 'Mới / chờ cọc', bar: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200', dot: 'bg-amber-500', soft: 'bg-amber-50' },
  CONFIRMED: { label: 'Đã chốt', bar: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200', dot: 'bg-emerald-500', soft: 'bg-emerald-50' },
  IN_PROGRESS: { label: 'Đang thực hiện', bar: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200', dot: 'bg-blue-500', soft: 'bg-blue-50' },
  COMPLETED: { label: 'Hoàn thành', bar: 'bg-violet-100 text-violet-800 ring-1 ring-violet-200', dot: 'bg-violet-500', soft: 'bg-violet-50' },
  CANCELLED: { label: 'Đã hủy', bar: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200', dot: 'bg-rose-400', soft: 'bg-rose-50' },
};

export const ORDER_STATUS_ORDER: OrderStatus[] = ['NEW', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export function orderStatusStyle(status: string): StatusStyle {
  return ORDER_STATUS_STYLE[(status as OrderStatus)] ?? ORDER_STATUS_STYLE.NEW;
}

// ---------------------------------------------------------------------------
// Span của đơn theo ngày + mức bận (capacity)
// ---------------------------------------------------------------------------

export interface OrderSpan {
  order: Order;
  startKey: string;
  endKey: string;
}

/** Khoảng ngày 1 đơn chiếm dụng = [eventDate, endDate ?? eventDate] (theo ngày VN). */
export function orderSpan(order: Order): OrderSpan {
  const startKey = vnDateKey(order.eventDate);
  const endRaw = order.endDate ? vnDateKey(order.endDate) : startKey;
  const endKey = endRaw < startKey ? startKey : endRaw;
  return { order, startKey, endKey };
}

/** Đơn có được tính vào "mức bận lịch" không — bỏ đơn đã hủy. */
export function isActiveForLoad(order: Order): boolean {
  return order.orderStatus !== 'CANCELLED';
}

export interface DayLoad {
  key: string;
  orders: Order[]; // đơn (active) phủ ngày này
}

/** Giới hạn số ngày 1 đơn được coi là "chiếm dụng lịch" — chặn đơn nhập endDate lỗi/quá xa tô kín
 * hàng trăm ngày trên heatmap. Event thuê thiết bị thực tế hiếm khi kéo dài quá ~3 tháng. */
const MAX_LOAD_SPAN_DAYS = 92;

/** Map ngày -> các đơn active phủ ngày đó (một đơn phủ mọi ngày trong span của nó, tối đa 92 ngày). */
export function buildDayLoad(orders: Order[]): Map<string, DayLoad> {
  const map = new Map<string, DayLoad>();
  for (const order of orders) {
    if (!isActiveForLoad(order)) continue;
    const { startKey, endKey } = orderSpan(order);
    const cappedEndKey = diffDaysKey(startKey, endKey) > MAX_LOAD_SPAN_DAYS ? addDaysKey(startKey, MAX_LOAD_SPAN_DAYS) : endKey;
    for (const key of enumerateDayKeys(startKey, cappedEndKey)) {
      let entry = map.get(key);
      if (!entry) {
        entry = { key, orders: [] };
        map.set(key, entry);
      }
      entry.orders.push(order);
    }
  }
  return map;
}

/** Ngưỡng tô đậm heatmap theo số đơn đồng thời trong ngày. */
export function loadLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

export const LOAD_LEVEL_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-slate-50 text-slate-300',
  1: 'bg-blue-50 text-blue-700',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-blue-300 text-blue-950',
  4: 'bg-blue-500 text-white',
};

export const LOAD_LEVEL_LABEL: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'Trống',
  1: '1 đơn',
  2: '2 đơn',
  3: '3–4 đơn',
  4: '≥5 đơn (rất kín)',
};

// ---------------------------------------------------------------------------
// Lịch nhân sự + phát hiện trùng
// ---------------------------------------------------------------------------

/** Giờ nghỉ mặc định nếu plan thiếu endTime (Timestamp end_time nullable) — coi như khối 2 giờ để vẫn
 * so chồng lấn được; đánh dấu estimated=true để UI biết đây là ước lượng. */
const DEFAULT_PLAN_DURATION_MS = 2 * 60 * 60 * 1000;

export interface StaffBlock {
  planId: string;
  planCode: string;
  orderId: string;
  orderCode: string;
  eventName: string;
  taskCode: string;
  taskName: string;
  role: 'LEAD' | 'TECHNICAL';
  startMs: number;
  endMs: number;
  estimatedEnd: boolean;
  status: SchedulePlan['status'];
  dayKey: string; // ngày VN của startTime
  conflict: boolean; // TRÙNG CỨNG: đè giờ với block khác, cả hai đều có giờ về thật
  suspected: boolean; // NGHI NGỜ: đè giờ nhưng ít nhất 1 block có giờ về ước lượng (2h) → chưa chắc
}

export interface StaffLane {
  userId: string;
  fullName: string;
  blocks: StaffBlock[];
  conflictCount: number; // số block trùng cứng
  suspectCount: number; // số block chỉ nghi ngờ trùng (không tính vào cảnh báo cứng)
  planCount: number;
}

function planEndMs(plan: SchedulePlan, startMs: number): { endMs: number; estimated: boolean } {
  if (plan.endTime) {
    const e = new Date(plan.endTime).getTime();
    if (!Number.isNaN(e) && e > startMs) return { endMs: e, estimated: false };
  }
  return { endMs: startMs + DEFAULT_PLAN_DURATION_MS, estimated: true };
}

/** Gom các plan (đã phân công) theo từng nhân sự, kèm cờ trùng giờ. Bỏ plan CANCELLED. */
export function buildStaffLanes(plans: SchedulePlan[]): StaffLane[] {
  const lanes = new Map<string, StaffLane>();
  for (const plan of plans) {
    if (plan.status === 'CANCELLED') continue;
    const startMs = new Date(plan.startTime).getTime();
    if (Number.isNaN(startMs)) continue;
    const { endMs, estimated } = planEndMs(plan, startMs);
    for (const a of plan.assignees ?? []) {
      let lane = lanes.get(a.userId);
      if (!lane) {
        lane = { userId: a.userId, fullName: a.fullName, blocks: [], conflictCount: 0, suspectCount: 0, planCount: 0 };
        lanes.set(a.userId, lane);
      }
      lane.blocks.push({
        planId: plan.planId,
        planCode: plan.planCode,
        orderId: plan.orderId,
        orderCode: plan.orderCode ?? plan.orderId,
        eventName: plan.eventName ?? '',
        taskCode: plan.taskCode ?? '',
        taskName: plan.taskName ?? plan.taskCode ?? '',
        role: a.role,
        startMs,
        endMs,
        estimatedEnd: estimated,
        status: plan.status,
        dayKey: vnDateKey(plan.startTime),
        conflict: false,
        suspected: false,
      });
    }
  }
  // Phát hiện trùng giờ trong từng nhân sự (so chồng lấn epoch). Chỉ tính TRÙNG CỨNG khi cả hai block
  // có giờ về THẬT; nếu ít nhất 1 block dùng giờ về ước lượng (2h mặc định do endTime null) thì chỉ đánh
  // 'nghi ngờ' — tránh cảnh báo trùng giả (xem planEndMs).
  for (const lane of lanes.values()) {
    lane.blocks.sort((a, b) => a.startMs - b.startMs);
    for (let i = 0; i < lane.blocks.length; i += 1) {
      for (let j = i + 1; j < lane.blocks.length; j += 1) {
        const a = lane.blocks[i];
        const b = lane.blocks[j];
        if (b.startMs >= a.endMs) break; // đã sort theo start, hết chồng lấn với a
        if (a.startMs < b.endMs && b.startMs < a.endMs) {
          if (!a.estimatedEnd && !b.estimatedEnd) {
            a.conflict = true;
            b.conflict = true;
          } else {
            a.suspected = true;
            b.suspected = true;
          }
        }
      }
    }
    lane.planCount = lane.blocks.length;
    lane.conflictCount = lane.blocks.filter((b) => b.conflict).length;
    lane.suspectCount = lane.blocks.filter((b) => b.suspected && !b.conflict).length;
  }
  return [...lanes.values()].sort((a, b) => {
    if (b.conflictCount !== a.conflictCount) return b.conflictCount - a.conflictCount; // trùng cứng lên đầu
    if (b.suspectCount !== a.suspectCount) return b.suspectCount - a.suspectCount;
    return a.fullName.localeCompare(b.fullName, 'vi');
  });
}

// ---------------------------------------------------------------------------
// Thiết bị đi / về (suy từ schedule plan SETUP/COLLECT|RETURN)
// ---------------------------------------------------------------------------

export type MovementKind = 'OUT' | 'IN';

const OUT_TASK_CODES = new Set(['SETUP']); // đi: mang thiết bị ra khỏi kho để lắp
const IN_TASK_CODES = new Set(['COLLECT', 'RETURN']); // về: thu hồi về kho

export interface EquipmentMovement {
  planId: string;
  planCode: string;
  orderId: string;
  orderCode: string;
  eventName: string;
  customerName: string;
  kind: MovementKind;
  taskCode: string;
  startMs: number;
  endMs: number;
  estimatedEnd: boolean;
  dayKey: string;
  status: SchedulePlan['status'];
  leadName?: string;
  location?: string;
}

// ---------------------------------------------------------------------------
// Trục giờ trong ngày (dùng cho lịch nhân sự + thiết bị đi/về)
// ---------------------------------------------------------------------------

export const DEFAULT_DAY_START_HOUR = 6; // khung mặc định khi ngày không có việc
export const DEFAULT_DAY_END_HOUR = 22;

/** Giờ bắt đầu/kết thúc (thập phân) của 1 block trong 1 ngày cụ thể, đã xử lý qua đêm: nếu kết thúc
 * sang ngày sau thì kẹp về 24h (cuối ngày). Nhờ vậy khung giờ động sẽ tự bao được cả block khuya. */
export function blockDayHours(startMs: number, endMs: number, selectedDay: string): { start: number; end: number } {
  const start = vnHourFloat(startMs);
  const end = vnDateKey(endMs) > selectedDay ? 24 : vnHourFloat(endMs);
  return { start, end: Math.max(end, start) };
}

/** Khung giờ hiển thị của 1 ngày, co giãn theo dữ liệu thật (min start → max end), kẹp [0,24], tối
 * thiểu rộng 6 tiếng để dễ đọc. Rỗng -> khung mặc định 06–22h. Nhờ động nên KHÔNG ẩn mất việc sớm/khuya. */
export function computeDayHourWindow(pairs: { start: number; end: number }[]): [number, number] {
  if (pairs.length === 0) return [DEFAULT_DAY_START_HOUR, DEFAULT_DAY_END_HOUR];
  let mn = 24;
  let mx = 0;
  for (const p of pairs) {
    mn = Math.min(mn, p.start);
    mx = Math.max(mx, p.end);
  }
  const winStart = Math.max(0, Math.floor(mn));
  let winEnd = Math.min(24, Math.ceil(mx));
  if (winEnd <= winStart) winEnd = Math.min(24, winStart + 1);
  if (winEnd - winStart < 6) winEnd = Math.min(24, winStart + 6);
  return [winStart, winEnd];
}

/** % từ trái của 1 giờ thập phân trên khung [winStart, winEnd]. */
export function hourToLeftPct(hourFloat: number, winStart: number, winEnd: number): number {
  const span = Math.max(winEnd - winStart, 1);
  const clamped = Math.min(Math.max(hourFloat, winStart), winEnd);
  return ((clamped - winStart) / span) * 100;
}

/** Vị trí + bề rộng (%) của 1 block giờ trong khung. Trả null nếu nằm hoàn toàn ngoài khung. */
export function blockHourGeometry(
  startHour: number,
  endHour: number,
  winStart: number,
  winEnd: number,
): { leftPct: number; widthPct: number } | null {
  const s = Math.max(startHour, winStart);
  const e = Math.min(Math.max(endHour, startHour), winEnd);
  if (e <= winStart || s >= winEnd) return null;
  const left = hourToLeftPct(s, winStart, winEnd);
  const right = hourToLeftPct(e, winStart, winEnd);
  return { leftPct: left, widthPct: Math.max(right - left, 1.5) };
}

/** Danh sách mốc giờ nguyên để vẽ vạch trục trong khung. */
export function hourTicks(winStart: number, winEnd: number): number[] {
  const out: number[] = [];
  for (let h = Math.ceil(winStart); h <= Math.floor(winEnd); h += 1) out.push(h);
  return out;
}

export function movementKindOf(taskCode?: string): MovementKind | null {
  if (!taskCode) return null;
  if (OUT_TASK_CODES.has(taskCode)) return 'OUT';
  if (IN_TASK_CODES.has(taskCode)) return 'IN';
  return null;
}

/** Trích các mốc thiết bị đi/về từ schedule plan (bỏ CANCELLED, bỏ SURVEY). */
export function extractEquipmentMovements(plans: SchedulePlan[]): EquipmentMovement[] {
  const out: EquipmentMovement[] = [];
  for (const plan of plans) {
    if (plan.status === 'CANCELLED') continue;
    const kind = movementKindOf(plan.taskCode);
    if (!kind) continue;
    const startMs = new Date(plan.startTime).getTime();
    if (Number.isNaN(startMs)) continue;
    const { endMs, estimated } = planEndMs(plan, startMs);
    out.push({
      planId: plan.planId,
      planCode: plan.planCode,
      orderId: plan.orderId,
      orderCode: plan.orderCode ?? plan.orderId,
      eventName: plan.eventName ?? '',
      customerName: plan.customerName ?? '',
      kind,
      taskCode: plan.taskCode ?? '',
      startMs,
      endMs,
      estimatedEnd: estimated,
      dayKey: vnDateKey(plan.startTime),
      status: plan.status,
      leadName: (plan.assignees ?? []).find((a) => a.role === 'LEAD')?.fullName,
      location: plan.location ?? plan.orderLocation,
    });
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}
