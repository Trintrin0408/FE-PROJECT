// Mới hoàn toàn — chưa từng có type/service tương ứng ở frontend trước đợt refactor này.
// Nguồn: D:\bnwems-backend-api prisma/schema.prisma (model Attendance), attendance.route.ts.
// Ràng buộc: chỉ người được assignedTo của SchedulePlan mới check-in được cho plan đó; 1 người chỉ
// có 1 bản ghi điểm danh / 1 plan (@@unique([planId, userId])).

export interface Attendance {
  attendanceId: string;
  planId: string;
  userId: string;
  checkInAt?: string;
  checkInEvidenceId?: string;
  checkOutAt?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// POST /api/v1/attendance/check-in
export interface CheckInPayload {
  planId: string;
  checkInEvidenceId?: string;
  checkInAt: string; // ISO datetime
}

// PUT /api/v1/attendance/:id/check-out
export interface CheckOutPayload {
  checkOutAt: string; // ISO datetime
  note?: string;
}

export interface AttendanceListItem {
  assigneeId: string;
  planId: string;
  userId: string;
  role: 'LEAD' | 'TECHNICAL';
  notes?: string | null;
  createdAt: string;
  attendance?: {
    attendanceId: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    latitude: number | null;
    longitude: number | null;
    checkInEvidenceId: string | null;
    note: string | null;
  } | null;
  user: {
    userId: string;
    fullName: string;
    employeeCode: string | null;
    avatarUrl: string | null;
  };
  plan: {
    planId: string;
    orderId: string;
    taskId: string;
    startTime: string;
    endTime: string | null;
    status: string;
    order: {
      orderId: string;
      orderCode: string;
      eventName: string | null;
      eventDate: string;
    };
    task: {
      taskId: string;
      taskCode: string;
      taskName: string;
    };
  };
}

export interface ListAttendancesMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}
