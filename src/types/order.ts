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
  location: string;
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
  location: string;
  guestCount?: number;
  items: CreateOrderItemPayload[]; // tối thiểu 1
  notes?: string;
}

// POST /api/v1/orders trả về — KHÔNG trả full object, chỉ 2 field.
export interface CreateOrderResult {
  orderId: string;
  orderCode: string;
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

// POST /api/v1/orders/:orderId/export-equipment — docs/xuatthietbi_tubaogia_api.md mục 4.3 (bản v2:
// reconcile theo báo giá liên kết — đồng bộ order_items theo quotation_items rồi xuất bù OUTBOUND /
// thu hồi chênh lệch INBOUND; bấm lặp lại hợp lệ, no-op trả unchanged: true). Chỉ dòng source=INTERNAL
// mới đụng kho; dòng SUPPLIER trả về ở skippedSupplierItems.
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
  movements: ExportEquipmentMovement[];
  skippedSupplierItems: { itemId: string; itemName: string; quantity: number }[];
  unchanged: boolean;
}

// Shape `details.items` của lỗi 400 "Tồn kho không đủ để xuất thiết bị" (envelope lỗi chung
// { error: { code, message, details } }).
export interface ExportEquipmentShortageItem {
  itemId: string;
  itemName: string;
  required: number;
  available: number;
}
