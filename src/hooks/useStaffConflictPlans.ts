import { useEffect, useState } from 'react';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import type { SchedulePlan } from '@/types/schedulePlan';

export interface StaffConflictDateWindow {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

// Lấy toàn bộ lịch trình (mọi đơn) giao với khoảng ngày cần kiểm tra, để tìm nhân sự đang bận trùng
// giờ. GET /schedule-plans?dateFrom&dateTo (không truyền orderId) đã xác nhận hoạt động thật qua curl
// 2026-07-21 (xem đính chính trong src/types/schedulePlan.ts) — server lọc ở mức khoảng ngày của đơn
// (có thể trả dư, không lọc thiếu), nên bên gọi hook này luôn phải tự lọc chính xác theo giờ
// (buildStaffConflictMap trong src/utils/staffAvailability.ts) trước khi dùng kết quả.
export function useStaffConflictPlans(dateWindow: StaffConflictDateWindow | null): { plans: SchedulePlan[]; isLoading: boolean } {
  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!dateWindow) {
      setPlans([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    schedulePlanApiService
      .getSchedulePlans({ dateFrom: dateWindow.from, dateTo: dateWindow.to, limit: 200 })
      .then((res) => {
        if (cancelled) return;
        setPlans(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setPlans([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Cố ý chỉ theo dõi from/to (giá trị nguyên thủy) thay vì cả object dateWindow — object này thường
    // là literal mới tạo mỗi lần render ở phía gọi hook, dùng cả object làm dep sẽ khiến effect chạy
    // lại mỗi render thay vì chỉ khi ngày đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateWindow?.from, dateWindow?.to]);

  return { plans, isLoading };
}
