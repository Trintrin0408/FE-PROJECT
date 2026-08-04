// GET /api/v1/schedule-plans — thay thế Schedule/Assignment cũ.
// Nguồn: D:\bnwems-backend-api prisma/schema.prisma (model SchedulePlan), operations.route.ts,
// operations.validator.ts, operations.service.ts.
//
// ĐÍNH CHÍNH 2026-07-21 (đối chiếu qua curl thật với backend đang chạy): comment cũ ở đây ghi "1 plan
// = 1 người được giao (assignedTo)... khái niệm nhiều người không còn tồn tại" — SAI, đã xác nhận
// ngược lại. `POST /schedule-plans` nhận field `assignedTo: string` nhưng field này bị BỎ QUA hoàn
// toàn ở backend (validate qua nhưng response trả `assignees: []`, không gắn ai) — `assignedTo` trong
// `CreateSchedulePlanPayload` là field chết, không nên gửi lên nữa. Model đa phân công thật đang hoạt
// động qua 1 endpoint RIÊNG chưa có trong doc cũ: `POST /schedule-plans/:id/assignees` (xem
// `AddScheduleAssigneePayload` dưới) — gọi 1 lần cho mỗi người muốn gán vào plan, trả lại full
// `SchedulePlan` kèm `assignees[]` đã cập nhật, lỗi `ALREADY_ASSIGNED` nếu gán trùng 1 người 2 lần.

export type ScheduleStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface SchedulePlan {
  planId: string;
  planCode: string;
  orderId: string;
  taskId: string;
  assignedTo: string;
  startTime: string;
  endTime?: string;
  location?: string;
  // Bổ sung 2026-08-03 (đối chiếu source thật `schedule.repository.ts`/`schedule.service.ts`/
  // `schedule.validators.ts` tại D:\sep490-backend-api): schedule_plans.latitude/longitude là 2 cột
  // thật (cùng migration với orders.latitude/longitude), POST/PUT /schedule-plans đã nhận sẵn 2 field
  // này (z.coerce.number().optional()) và GET đã trả kèm qua mapPlan — không phải mock, FE trước đây
  // chỉ chưa gửi/hiển thị.
  latitude?: number | null;
  longitude?: number | null;
  status: ScheduleStatus;
  evidenceId?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  taskName?: string; // join thêm khi GET
  // Đính chính 2026-08-03 (đọc source thật `schedule.service.ts` `SchedulePlanDTO`/`mapPlan` tại
  // D:\sep490-backend-api): GET /schedule-plans đã trả sẵn `taskCode` ('SURVEY'/'SETUP'/'COLLECT', theo
  // `work_tasks.task_code`) — dùng để phân biệt lịch trình có thật sự giữ thiết bị hay không (SETUP/
  // COLLECT có, SURVEY thì không), vd khi tính khung giờ khóa kho (`utils/inventoryLock.ts`).
  taskCode?: string;
  assigneeName?: string; // join thêm khi GET — KHÔNG khớp response thật, xem `assignees` dưới
  // Xác nhận qua curl thật 2026-07-20 (docs/more-require.md mục (f)): GET /schedule-plans trả đúng
  // model đa phân công thật (schedule_plan_assignees), không phải 1 assigneeName đơn.
  // Đính chính 2026-08-02 (đọc source thật `schedule.service.ts` `AssigneeDTO` tại
  // D:\sep490-backend-api): API đã trả sẵn checkInEvidenceId/latitude/longitude cho từng assignee (phục
  // vụ chấm công GPS), FE type trước đây bỏ sót 3 field này dù JSON response đã có.
  assignees?: {
    userId: string;
    fullName: string;
    role: 'LEAD' | 'TECHNICAL';
    phone?: string;
    checkInAt?: string | null;
    checkOutAt?: string | null;
    checkInEvidenceId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }[];
  orderCode?: string; // join thêm khi GET
  customerName?: string; // join thêm khi GET
  eventName?: string; // join thêm khi GET
  // Đính chính 2026-07-21 (curl thật): GET /schedule-plans (kể cả không truyền orderId) đã join sẵn
  // TOÀN BỘ field dưới đây — đúng yêu cầu đề xuất ở docs/kehoachvaphancong_api.md mục 6/
  // docs/lichtimeline_api.md mục 2.2, không cần Backend làm thêm gì nữa.
  eventDate?: string; // join thêm khi GET — orders.event_date
  orderLocation?: string; // join thêm khi GET — orders.location
}

export interface GetSchedulePlansQuery {
  page?: number;
  limit?: number;
  orderId?: string;
  assignedTo?: string;
  status?: ScheduleStatus;
  date?: string; // YYYY-MM-DD
  // Đính chính 2026-07-21 (curl thật): 2 param đề xuất ở docs/kehoachvaphancong_api.md mục 6 điểm 1 và
  // docs/lichtimeline_api.md mục 2.1 ĐÃ hoạt động thật ở backend — bỏ trống orderId + truyền dateFrom/
  // dateTo trả về toàn bộ đơn có khoảng [event_date, MAX(end_time)] giao với cửa sổ ngày.
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  // Bổ sung 2026-08-03 (đối chiếu `schedule.validators.ts` tại D:\sep490-backend-api): 'timeline' (mặc
  // định) lọc theo [orders.event_date, MAX(end_time)] của cả đơn; 'plan' lọc trực tiếp theo start_time
  // của TỪNG dòng schedule_plan — dùng 'plan' khi cần đúng các plan thật sự diễn ra trong 1 khoảng ngày
  // cụ thể (vd "việc cần làm hôm nay" ở dashboard), tránh dính việc của đơn khác chỉ vì event_date rơi
  // vào cửa sổ đang lọc.
  dateMode?: 'timeline' | 'plan';
}

// POST /api/v1/schedule-plans — `assignedTo` khai bắt buộc ở validator nhưng bị bỏ qua ở tầng service
// (xem đính chính ở đầu file) nên để optional ở type, không nên gửi lên nữa; gán người dùng
// `POST /schedule-plans/:id/assignees` (AddScheduleAssigneePayload) ngay sau khi tạo.
export interface CreateSchedulePlanPayload {
  orderId: string;
  taskId: string;
  assignedTo?: string;
  startTime: string; // ISO datetime
  endTime?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

// POST /api/v1/schedule-plans/:id/assignees — xác nhận qua curl thật 2026-07-21, KHÔNG có trong tài
// liệu API cũ (docs/lichtrinhkythuat_api.md mục 4 mới chỉ suy luận model đa phân công từ dữ liệu mẫu,
// chưa biết endpoint ghi). Trả lại full SchedulePlan (kèm assignees[] mới), lỗi 1 người 2 lần trả
// { code: 'ALREADY_ASSIGNED' }.
export interface AddScheduleAssigneePayload {
  userId: string;
  role: 'LEAD' | 'TECHNICAL';
}

// PUT /api/v1/schedule-plans/:id — chỉ sửa được khi status khác IN_PROGRESS/COMPLETED
export interface UpdateSchedulePlanPayload {
  startTime?: string;
  endTime?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

// PATCH /api/v1/schedule-plans/:id/status
export interface UpdateSchedulePlanStatusPayload {
  status: ScheduleStatus;
  notes?: string;
  evidenceId?: string;
}
