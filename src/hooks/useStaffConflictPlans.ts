import { useEffect, useState } from 'react';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import type { SchedulePlan } from '@/types/schedulePlan';

export interface StaffConflictDateWindow {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

// Lấy toàn bộ lịch trình (mọi đơn) có GIỜ giao với khoảng ngày cần kiểm tra, để tìm nhân sự đang bận
// trùng giờ. BẮT BUỘC dùng dateMode:'plan' — chế độ này lọc theo start_time của TỪNG lịch. KHÔNG được
// để mặc định 'timeline': timeline lọc theo [orders.event_date, MAX(end_time)] của cả đơn, nên các lịch
// diễn ra TRƯỚC ngày sự kiện (điển hình là lịch KHẢO SÁT) sẽ bị BỎ SÓT khi event_date của đơn nằm ngoài
// cửa sổ ngày đang check → không phát hiện được trùng lịch (bug: sửa lắp đặt về 23/08 09:00, Thắng đã có
// khảo sát 09:00 cùng đơn nhưng không cảnh báo vì đơn có event_date muộn hơn dateTo). Sau khi fetch,
// buildStaffConflictMap (src/utils/staffAvailability.ts) vẫn lọc lại chính xác theo giờ.
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
      .getSchedulePlans({ dateFrom: dateWindow.from, dateTo: dateWindow.to, dateMode: 'plan', limit: 200 })
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
