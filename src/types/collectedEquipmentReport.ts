// Nguồn: D:\sep490-backend-api\src\modules\inventory\{inventory.routes,inventory.service,
// inventory.validators}.ts — đây là backend ĐANG THỰC SỰ CHẠY (không phải D:\bnwems-backend-api, xem
// cảnh báo đầu docs/more-require.md). GET /return-reports (danh sách), GET /return-reports/:id (chi
// tiết) và PUT /return-reports/:id/confirm đều là API thật, IDs đều là string UUID (khớp DB).
//
// POST /return-reports chỉ role LEADER gọi được (403 với Manager/Admin) — Leader Staff ghi nhận qua
// mobile, KHÔNG có màn "Tạo phiếu" trên web (đúng CLAUDE.md: "Leader Staff ghi nhận trước, Manager chỉ
// xác nhận"). PUT .../confirm chỉ role MANAGER gọi được (Admin nhận 403 — đúng nguyên tắc "Admin không
// xử lý vận hành hằng ngày").

export type CollectedEquipmentReportType = 'INTERNAL' | 'SUPPLIER';
export type CollectedEquipmentReportStatus = 'SUBMITTED' | 'CONFIRMED';

export interface CollectedEquipmentReportItem {
  cerItemId: string;
  itemId: string;
  itemName: string;
  unit: string;
  goodQuantity: number;
  damagedQuantity: number;
  lostQuantity: number;
  notes: string | null;
}

export interface CollectedEquipmentReportActor {
  userId: string;
  fullName: string;
}

// GET /api/v1/inventory/return-reports/:reportId — cũng là shape từng dòng của GET (danh sách).
export interface CollectedEquipmentReport {
  reportId: string;
  orderId: string;
  orderCode: string;
  reportType: CollectedEquipmentReportType;
  transactionId: string | null;
  status: CollectedEquipmentReportStatus;
  reportedBy: CollectedEquipmentReportActor;
  confirmedBy: CollectedEquipmentReportActor | null;
  confirmedAt: string | null;
  notes: string | null;
  createdAt: string;
  items: CollectedEquipmentReportItem[];
}

// GET /api/v1/inventory/return-reports — không hỗ trợ tìm kiếm tự do (search), chỉ status/orderId.
export interface GetReturnReportsQuery {
  status?: CollectedEquipmentReportStatus;
  orderId?: string;
  page?: number;
  limit?: number;
}

export interface ReturnReportListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

// POST /api/v1/mobile/orders/:id/collected-reports — Leader Staff ghi nhận qua mobile (ngoài phạm vi
// web); orderId lấy từ path param, không nằm trong body. Xem services/fieldOps.service.ts.
export interface CreateCollectedEquipmentReportPayload {
  reportType: CollectedEquipmentReportType;
  transactionId?: string;
  notes?: string;
  items: { itemId: string; goodQuantity: number; damagedQuantity: number; lostQuantity: number; notes?: string }[];
}
