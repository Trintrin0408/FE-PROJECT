// Mirror thuần hiển thị của logic khóa/nhả tồn kho thật ở Backend (`getLockedQuantityByDate`,
// D:\sep490-backend-api\src\modules\inventory\inventory.repository.ts) — dùng để hiện cho Manager biết
// RÕ khung giờ 1 đơn đang giữ chỗ thiết bị, KHÔNG dùng để tự tính lại số lượng khả dụng (số đó luôn lấy
// từ `GET /inventory` — Backend là nguồn đúng duy nhất).
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

// Chỉ 2 loại lịch trình này thật sự mang thiết bị ra khỏi kho (SETUP = lắp đặt, COLLECT = thu hồi) —
// SURVEY (khảo sát hiện trường) không đụng tới thiết bị nên KHÔNG được tính vào khung giờ khóa kho,
// nếu không khung khóa sẽ bị kéo lùi về tận ngày khảo sát (thường trước ngày tổ chức hàng tuần), khóa
// oan thiết bị suốt khoảng không hề dùng tới. Khớp đúng filter ở Backend (`getLockedQuantityByDate`,
// D:\sep490-backend-api\src\modules\inventory\inventory.repository.ts).
const EQUIPMENT_HOLDING_TASK_CODES = new Set(['SETUP', 'COLLECT']);

export interface LockWindow {
  lockFrom: number; // epoch ms — thời điểm bắt đầu khóa (min mốc bắt đầu - 6h)
  lockUntil: number | null; // epoch ms — thời điểm nhả khóa (max mốc kết thúc + 6h); null = chưa xác định (chưa có mốc kết thúc nào)
}

/** Tính khung giờ khóa kho của 1 đơn, dựa trên order.eventDate/endDate + các schedulePlans THẬT SỰ giữ
 * thiết bị (SETUP/COLLECT, chưa CANCELLED) của đơn đó — bỏ qua SURVEY và lịch trình đã hủy. */
export function computeOrderLockWindow(
  order: { eventDate: string; endDate?: string | null },
  schedulePlans: { startTime: string; endTime?: string | null; taskCode?: string; status?: string }[],
): LockWindow {
  const startCandidates: number[] = [new Date(order.eventDate).getTime()];
  const endCandidates: number[] = [];

  if (order.endDate) endCandidates.push(new Date(order.endDate).getTime());

  const equipmentPlans = schedulePlans.filter(
    (plan) => plan.status !== 'CANCELLED' && (!plan.taskCode || EQUIPMENT_HOLDING_TASK_CODES.has(plan.taskCode)),
  );

  for (const plan of equipmentPlans) {
    startCandidates.push(new Date(plan.startTime).getTime());
    if (plan.endTime) endCandidates.push(new Date(plan.endTime).getTime());
  }

  const lockFrom = Math.min(...startCandidates) - SIX_HOURS_MS;
  const lockUntil = endCandidates.length > 0 ? Math.max(...endCandidates, ...startCandidates) + SIX_HOURS_MS : null;

  return { lockFrom, lockUntil };
}
