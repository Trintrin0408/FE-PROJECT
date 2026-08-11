// Validate ngày/giờ dùng chung cho các form lịch trình (CreateSchedulePlanModal, EditSchedulePlanModal,
// PlanFormDrawer) — tách ra để tránh lặp lại logic ở nhiều nơi.

/** Khảo sát hiện trường & lắp đặt thiết bị phải hoàn tất trong hoặc trước ngày tổ chức sự kiện
 *  (được phép rơi vào chính ngày sự kiện — tiệc cưới thường sáng lắp/tối tiệc). */
export function isDateRestrictedTaskName(taskName: string | undefined): boolean {
  if (!taskName) return false;
  return /khảo sát|lắp đặt/i.test(taskName);
}

/** Mốc chặn trên (exclusive) cho khảo sát/lắp đặt: 00:00 của NGÀY KẾ TIẾP ngày sự kiện (giờ local).
 *  So với mốc này (thay vì 00:00 ngày sự kiện) để cho phép xếp việc vào chính ngày diễn ra sự kiện,
 *  chỉ chặn khi tràn sang ngày hôm sau (chốt 2026-08-11 sau test E2E). */
function eventDayEndExclusive(eventDate: string): number {
  const d = new Date(eventDate);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

export function getStartTimeError(startTime: string, eventDate: string | undefined, isRestricted: boolean): string | undefined {
  if (!startTime) return undefined;
  const start = new Date(startTime);
  if (start.getTime() < Date.now()) return 'Không thể chọn thời gian trong quá khứ.';
  if (isRestricted && eventDate && start.getTime() >= eventDayEndExclusive(eventDate)) {
    return 'Thời gian bắt đầu không được muộn hơn ngày diễn ra sự kiện.';
  }
  return undefined;
}

export function getEndTimeError(startTime: string, endTime: string, eventDate: string | undefined, isRestricted: boolean): string | undefined {
  if (!endTime) return undefined;
  const end = new Date(endTime);
  if (startTime && end.getTime() <= new Date(startTime).getTime()) {
    return 'Thời gian kết thúc phải sau thời gian bắt đầu.';
  }
  if (end.getTime() < Date.now()) return 'Không thể chọn thời gian trong quá khứ.';
  if (isRestricted && eventDate && end.getTime() >= eventDayEndExclusive(eventDate)) {
    return 'Thời gian kết thúc không được muộn hơn ngày diễn ra sự kiện.';
  }
  return undefined;
}

/** datetime-local input cần định dạng "yyyy-MM-ddTHH:mm" theo giờ local (không phải ISO UTC). */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
