// docs/api/08-quotations.md — ĐÃ LỖI THỜI sau đợt backend refactor 2026-07-06. Kiến trúc đổi hẳn:
// Quotation giờ thuộc CUSTOMER (không thuộc Order). Order chỉ có `quotationId` FK optional, tham
// chiếu 1 quotation có sẵn để lưu vết — KHÔNG tự copy items từ quotation sang order.
// Nguồn: D:\bnwems-backend-api prisma/schema.prisma (model Quotation/QuotationItem),
// customer.route.ts, quotation.route.ts, quotation.validator.ts, quotation.service.ts.

export type QuotationStatus = 'DRAFT' | 'APPROVED' | 'REJECTED';

export interface QuotationItem {
  quotationItemId?: string;
  quotationId?: string;
  itemId: string;
  itemName?: string; // snapshot lúc tạo, do backend tự tra từ Item rồi lưu lại
  quantity: number;
  price: number;
  discount?: number;
  lineTotal?: number; // generated column, chỉ có khi đọc lại (GET)
  // ⚠️ 2026-07-07: "nội dung báo giá" cho hạng mục — theo schema mới phát hiện trên MySQL local
  // (equipment_categories → equipment_type_details → equipment_type_configs → catalog_items, xem
  // docs/database.md mục 3), nội dung này lấy từ `equipment_type_details.description` khi
  // `catalog_items.description` của hạng mục để trống. Bảng quotation_items KHÔNG có cột riêng cho
  // nội dung này — phải resolve qua chuỗi item → config → type_detail lúc hiển thị. Backend hiện
  // chưa có join/endpoint nào cho tầng type_detail/config (docs/more-require.md mục (ii)), nên field
  // này KHÔNG đến từ API — luôn được tính ở client bằng src/utils/catalogItemContent.ts và hiển thị
  // in nghiêng khi là dữ liệu mock.
  content?: string;
}

// GET /api/v1/customers/:customerId/quotations
export interface Quotation {
  quotationId: string;
  quotationCode: string;
  customerId: string;
  version: string; // vd "v1.0" — chuỗi tự do, KHÔNG auto-increment
  subtotal: number;
  discountTotal: number;
  totalAmount: number;
  status: QuotationStatus;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// GET /api/v1/quotations/:id — kèm include items
export interface QuotationDetail extends Quotation {
  items: QuotationItem[];
}

// POST /api/v1/customers/:customerId/quotations, PUT /api/v1/quotations/:id
// ĐÍNH CHÍNH 2026-07-21 (curl thật): `version` khai `?` (optional) nhưng backend bắt buộc có mặt ở
// CẢ 2 trường hợp tạo mới lẫn update — thiếu field này khi PUT sẽ luôn bị 400 VALIDATION_ERROR
// ("version: expected string, received undefined"), dù comment cũ ghi "không dùng khi update". Khi
// update, gửi lại đúng version hiện tại của báo giá (không đổi version chỉ vì sửa hạng mục).
export interface SaveQuotationPayload {
  version: string;
  notes?: string;
  items: { itemId: string; quantity: number; price: number; discount?: number }[]; // tối thiểu 1
}

// PATCH /api/v1/quotations/:id/status — xác nhận qua curl thật 2026-07-20: backend chỉ nhận lowercase
// và chỉ 2 giá trị này (không thể PATCH ngược về "draft" — trạng thái khởi tạo, chỉ đi tới APPROVED/
// REJECTED). Khai báo cũ (QuotationStatus, uppercase, có cả 'DRAFT') sai cả kiểu chữ và tập giá trị.
export interface UpdateQuotationStatusPayload {
  status: 'approved' | 'rejected';
}

// GET /api/v1/quotations — màn danh sách báo giá xuyên mọi khách hàng (docs/danhsachbaogia_api.md mục 4.1)
export type QuotationListStatus = 'draft' | 'approved' | 'rejected';

export interface QuotationListItem {
  quotationId: string;
  code: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  version: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  status: QuotationListStatus;
  createdAt: string;
}

export interface QuotationListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  counts: {
    all: number;
    draft: number;
    approved: number;
    rejected: number;
    approvedValue: number;
  };
}

export interface GetQuotationsQuery {
  search?: string;
  status?: QuotationListStatus;
  customerId?: string;
  page?: number;
  limit?: number;
}

// GET /api/v1/quotations/:id — xác nhận qua curl thật 2026-07-20: response ĐÃ trả đúng shape mở rộng
// (JOIN customerEmail/customerAddress, createdBy object, linkedOrderId, items[].categoryName/unit) mà
// docs/xemchitietbaogia_api.md mục 5.1 đề xuất — không phải đề xuất chờ Backend làm, đã có sẵn thật.
export interface QuotationDetailItem {
  quotationItemId: string;
  itemId: string;
  itemName: string;
  categoryName: string;
  unit: string;
  quantity: number;
  price: number;
  discount: number;
  lineTotal: number;
}

export interface QuotationDetailApi {
  quotationId: string;
  quotationCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerAddress: string | null;
  version: string;
  subtotal: number;
  discountTotal: number;
  totalAmount: number;
  status: QuotationListStatus;
  notes: string | null;
  createdBy: { userId: string; fullName: string; role: string };
  createdAt: string;
  updatedAt: string;
  linkedOrderId: string | null;
  items: QuotationDetailItem[];
}
