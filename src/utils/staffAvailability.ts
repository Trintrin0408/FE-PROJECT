import type { SchedulePlan } from '@/types/schedulePlan';

// Backend không có field "thời lượng công việc" — SchedulePlan.endTime là optional
// (src/types/schedulePlan.ts). Khi thiếu endTime, coi việc kéo dài mặc định 2 giờ để tính overlap.
export const DEFAULT_TASK_DURATION_MS = 2 * 60 * 60 * 1000;

export interface StaffConflict {
  planId: string;
  planCode: string;
  orderCode?: string;
  eventName?: string;
  taskName?: string;
  startTime: string;
  endTime?: string;
}

function effectiveRange(startTime: string, endTime: string | undefined): [number, number] {
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : start + DEFAULT_TASK_DURATION_MS;
  return [start, end];
}

export function rangesOverlap(aStart: string, aEnd: string | undefined, bStart: string, bEnd: string | undefined): boolean {
  const [s1, e1] = effectiveRange(aStart, aEnd);
  const [s2, e2] = effectiveRange(bStart, bEnd);
  return s1 < e2 && s2 < e1;
}

/** Duyệt danh sách lịch trình (mọi đơn), trả về map userId -> các lịch trình đang trùng khung giờ [targetStart, targetEnd]. */
export function buildStaffConflictMap(
  plans: SchedulePlan[],
  targetStart: string,
  targetEnd: string | undefined,
  excludePlanId?: string,
): Map<string, StaffConflict[]> {
  const map = new Map<string, StaffConflict[]>();
  if (!targetStart) return map;
  for (const plan of plans) {
    if (plan.planId === excludePlanId) continue;
    if (plan.status === 'CANCELLED') continue;
    if (!rangesOverlap(targetStart, targetEnd, plan.startTime, plan.endTime)) continue;
    for (const assignee of plan.assignees ?? []) {
      const list = map.get(assignee.userId) ?? [];
      list.push({
        planId: plan.planId,
        planCode: plan.planCode,
        orderCode: plan.orderCode,
        eventName: plan.eventName,
        taskName: plan.taskName,
        startTime: plan.startTime,
        endTime: plan.endTime,
      });
      map.set(assignee.userId, list);
    }
  }
  return map;
}
