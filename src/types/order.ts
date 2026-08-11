// docs/api/09-orders.md — ĐÃ LỖI THỜI sau đợt backend refactor 2026-07-06 (xem docs/more-require.md
// mục mới nhất). Field/endpoint dưới đây lấy trực tiếp từ D:\bnwems-backend-api
// (prisma/schema.prisma model Order, order.route.ts, order.validator.ts, order.service.ts).

export type OrderStatus = 'NEW' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type OrderPaymentStatus = 'UNPAID' | 'DEPOSITED' | 'PAID';
export type OrderItemSource = 'INTERNAL' | 'SUPPLIER';

// Xác nhận qua curl thật 2026-07-20 (docs/thietbikhohang_api.md): itemName/unit là field TOP-LEVEL
// trên mỗi phần tử, không phải lồng trong `item.itemName` như khai báo cũ. `preparedBy` KHÔNG có
// trong response dù PATCH nhận được field này — xem docs/more-require.md mục (w). Category chưa
// join (doc mục 8, chưa implement).
export interface OrderItem {
  orderItemId?: string;
  itemId: string;
  itemName?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  subtotal?: number;
  source: OrderItemSource;
  preparedQty?: number;
  notes?: string;
}

// GET /api/v1/orders — customerName/customerPhone xác nhận có JOIN sẵn qua test thật ngày 2026-07-20
// (curl trực tiếp backend đang chạy), khác giả định ban đầu ở docs/danhsachdondat_api.md mục 1.2.
export interface Order {
  orderId: string;
  orderCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  quotationId?: string;
  policyId?: string;
  eventType: string;
  eventName?: string;
  eventDate: string;
  // Cột `orders.end_date` — GET /orders và /orders/:id trả field này (nullable). POST /orders NAY ĐÃ nhận
  // endDate (createOrderBodySchema optional + refine ≥ eventDate) để dựng cửa sổ giữ chỗ thiết bị.
  // Chưa có endpoint cập nhật endDate riêng sau khi tạo (PUT /orders/:id/items chỉ thay danh sách item).
  endDate?: string | null;
  location: string;
  /** Tọa độ địa điểm tổ chức — backend thật đã có sẵn 2 cột này (Prisma `Order.latitude/longitude`,
   * thêm cho tính năng GPS check-in nhân viên kỹ thuật), FE gán qua Goong Place Detail khi Manager chọn
   * gợi ý địa chỉ ở CreateOrderModal (2026-08-02). */
  latitude?: number;
  longitude?: number;
  guestCount?: number;
  totalAmount: number;
  paymentStatus: OrderPaymentStatus;
  orderStatus: OrderStatus;
  cancelReason?: string;
  notes?: string;
  // xác nhận qua curl thật 2026-07-20 (docs/tiendosukien_api.md mục 2): GET /orders/:id đã join sẵn
  // object {userId, fullName, role}, KHÔNG phải ID thô như comment cũ giả định — không cần round-trip
  // GET /users/:id để lấy tên "Điều phối viên".
  createdBy: { userId: string; fullName: string; role: string };
  createdAt: string;
  updatedAt?: string;
  closedAt?: string | null; // xác nhận qua curl thật 2026-07-20 — cột đã có (khác giả định cũ ở docs/tiendosukien_api.md mục 6)
  closedBy?: string | null;
  closedByName?: string | null; // tên người đóng đơn (join closer.fullName ở BE) — hiển thị thay userId thô
  // set bởi POST /orders/:id/export-equipment — null nếu chưa xuất kho
  pickedUpAt?: string | null;
  pickedUpBy?: string | null;
}

// GET /api/v1/orders — meta.counts đã có sẵn trên response thật (test 2026-07-20), dùng thẳng cho 6 thẻ
// KPI màn Danh sách đơn đặt — không cần endpoint /orders/stats riêng như docs/danhsachdondat_api.md mục 2
// từng đề xuất (đã cập nhật lại trong docs/more-require.md mục (e)).
export interface OrderListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  counts: {
    all: number;
    new: number;
    confirmed: number;
    inProgress: number;
    completed: number;
    cancelled: number;
  };
}

// GET /api/v1/orders/:id — xác nhận qua curl thật 2026-07-20: field tên là `items` (không phải
// `orderItems` như comment cũ giả định), và response KHÔNG kèm `orderWarnings`/`deposits`/
// `settlements` lồng sẵn (gọi riêng qua `paymentApiService.getOrderDeposits`/
// `settlementApiService.getOrderSettlement` — đã xác nhận hoạt động, xem docs/tiendosukien_api.md).
export interface OrderDetail extends Order {
  items: OrderItem[];
  orderWarnings?: OrderWarningSummary[];
  deposits?: OrderDepositSummary[];
  settlements?: OrderSettlementSummary[];
}

// Các shape rút gọn nhúng trong OrderDetail — xem services/payment.service.ts (Deposit),
// services/settlement.service.ts (Settlement). Không còn service riêng cho OrderWarning (endpoint
// GET/POST /orders/{id}/warnings đã bị bỏ khỏi frontend — docs/more-require.md mục (an.2)), type này
// chỉ còn phục vụ field nhúng sẵn trong OrderDetail.
export interface OrderWarningSummary {
  warningId: string;
  orderId: string;
  content: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface OrderDepositSummary {
  depositId: string;
  depositCode: string;
  orderId: string;
  amount: number;
  status: 'UNPAID' | 'PAID' | 'CANCELLED';
  createdAt: string;
}

export interface OrderSettlementSummary {
  settlementId: string;
  orderId: string;
  finalAmount: number;
  status: 'UNPAID' | 'PAID' | 'CANCELLED';
  createdAt: string;
}

// POST /api/v1/orders — createOrderSchema thật (order.validator.ts). Không tự copy items từ
// Quotation — items là danh sách độc lập của Order, phải nhập lại thủ công dù đã chọn quotationId.
export interface CreateOrderItemPayload {
  itemId: string;
  quantity: number;
  unitPrice: number;
  source?: OrderItemSource;
  notes?: string;
}

export interface CreateOrderPayload {
  customerId: string;
  quotationId?: string;
  policyId?: string;
  eventName?: string;
  eventType: string;
  eventDate: string; // ISO datetime string
  // Backend NAY ĐÃ nhận endDate ở POST /orders (createOrderBodySchema: optional + refine endDate ≥ eventDate).
  // Dùng để dựng cửa sổ giữ chỗ thiết bị [eventDate − đệm, endDate + turnaround]; bỏ trống → backend dùng eventDate.
  endDate?: string; // ISO datetime string, optional
  location: string;
  latitude?: number;
  longitude?: number;
  guestCount?: number;
  items: CreateOrderItemPayload[]; // tối thiểu 1
  notes?: string;
}

// Cảnh báo mềm (KHÔNG chặn) khi nhu cầu thiết bị nội bộ vượt khả dụng cho cửa sổ đơn — trả kèm khi tạo đơn.
export interface StockWarning {
  itemId: string;
  itemName: string;
  requested: number;
  available: number;
  windowStart: string;
  windowEnd: string;
}

// POST /api/v1/orders trả về orderId/orderCode + cảnh báo mềm (warnings[], rỗng nếu đủ hàng).
export interface CreateOrderResult {
  orderId: string;
  orderCode: string;
  warnings: StockWarning[];
}

// PUT /api/v1/orders/:id/status
export interface UpdateOrderStatusPayload {
  orderStatus: OrderStatus;
  cancelReason?: string;
  notes?: string;
}

// PUT /api/v1/orders/:id/items — thay TOÀN BỘ danh sách item (xoá hết rồi tạo lại)
export interface UpdateOrderItemsPayload {
  items: CreateOrderItemPayload[];
}

// PATCH /api/v1/orders/:orderId/live-checklist — xác nhận qua curl thật 2026-07-20 (đúng hướng đã
// chốt ở docs/tiendosukien_api.md mục 5/9.1): không có GET riêng, response PATCH trả lại object đầy
// đủ mới nhất — FE tự khởi tạo state ban đầu = tất cả false (không có cách đọc lại state cũ).
export interface LiveShowChecklist {
  backdrop: boolean;
  soundTest: boolean;
  powerBackup: boolean;
  operatorReady: boolean;
}

export interface UpdateLiveChecklistPayload {
  key: keyof LiveShowChecklist;
  checked: boolean;
}

// PUT /api/v1/orders/:orderId/close — xác nhận qua curl thật 2026-07-20: bắt buộc gửi body (dù rỗng
// {}), backend tự chặn 400 nếu orderStatus != COMPLETED hoặc paymentStatus != PAID hoặc đã đóng rồi.
export interface CloseOrderPayload {
  notes?: string;
}

// PATCH /api/v1/orders/:orderId/quotation — xác nhận qua curl thật 2026-07-20 (khác giả định "chưa có
// endpoint" của docs/baogiavahopdong_api.md mục 2 #4 — endpoint này ĐÃ hoạt động), trả về Order đầy đủ
// (không phải chỉ {orderId}). Dùng cho nút "Liên kết"/"Hủy liên kết" báo giá ở tab "Báo giá & Hợp đồng".
export interface UpdateOrderQuotationPayload {
  quotationId: string | null;
}

// POST /api/v1/orders/:orderId/export-equipment — docs/xuatthietbi_tubaogia_api.md mục 8 (CẬP NHẬT
// LẦN 3, 2026-08-03): CHỈ đồng bộ order_items theo quotation_items của báo giá liên kết — KHÔNG còn
// đụng tồn kho thật, không còn tạo inventory_movements. Bấm lặp lại hợp lệ, no-op trả unchanged: true.
export interface ExportEquipmentPayload {
  notes?: string;
}

export interface ExportEquipmentMovement {
  itemId: string;
  itemName: string;
  quantity: number;
  movementType: 'OUTBOUND' | 'INBOUND';
}

export interface ExportEquipmentResult {
  orderId: string;
  orderCode: string;
  syncedQuotationId: string;
  syncedQuotationCode: string;
  pickedUpAt: string | null;
  pickedUpBy: string | null;
  // Luôn là mảng rỗng từ 2026-08-03 — giữ field để tương thích, endpoint không còn tạo movement nào.
  movements: ExportEquipmentMovement[];
  skippedSupplierItems: { itemId: string; itemName: string; quantity: number }[];
  unchanged: boolean;
}
