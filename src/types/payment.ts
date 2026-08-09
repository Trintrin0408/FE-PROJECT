// docs/api/11-payments-settlement.md — ĐÃ LỖI THỜI sau đợt backend refactor 2026-07-06. Mô hình
// 2 tầng PaymentRequest→Payment (kèm VNPAY_QR/paymentUrl) đã bị XOÁ HẲN. Backend mới chỉ có 1 bảng
// phẳng `Deposit` (ghi nhận cọc), không có cổng thanh toán online — xem docs/more-require.md.
// Nguồn: D:\bnwems-backend-api prisma/schema.prisma (model Deposit), order.route.ts,
// deposit.route.ts, order.validator.ts.
//
// Xác nhận lại qua curl thật 2026-07-21 (docs/datcoc_api.md, cùng backend đang chạy):
// - Không có `GET /api/v1/deposits` gộp toàn hệ thống (404) — mọi API xoay quanh 1 đơn cụ thể.
// - `POST /orders/:id/deposits` giờ ĐÃ nhận `dueDate` (khác ghi nhận cũ của doc "không có cách set
//   dueDate") — đã test tạo thật, `dueDate` lưu đúng giá trị gửi lên.
// - `PUT /deposits/:id` CHỈ thật sự ghi được field `status` — `amount`/`notes` gửi kèm đều bị bỏ qua
//   hoàn toàn (đã test riêng từng field). Khóa cứng 1 chiều: gọi PUT lần 2 lên deposit đã
//   PAID/CANCELLED trả 400 BAD_REQUEST. Backend tự set `approvedBy`/`approvedAt`/`paymentDate` khi
//   chuyển PAID, và tự đồng bộ `orders.paymentStatus` UNPAID→DEPOSITED — FE không cần gọi thêm API
//   nào để đồng bộ.
// - Role: `POST`/`PUT` đều trả 403 FORBIDDEN với token ADMIN — xác nhận backend đã chặn đúng theo
//   CLAUDE.md mục 1 ("Admin không trực tiếp ghi nhận cọc"), không cần FE tự đoán, trang Admin chỉ nên
//   hiển thị xem/audit (không có nút ghi nhận/xác nhận).
// - Backend refactor 2026-07-26 (commit 4157a7f): rút gọn DepositStatus từ PENDING/SUCCESS/OVERDUE/
//   CANCELLED xuống UNPAID/PAID/CANCELLED — `PUT /deposits/:id` giờ chỉ nhận `status: 'PAID'|'CANCELLED'`.
// - Backend 2026-08-06 (commit d0db32a, docs/more-require.md mục ay): đổi bằng chứng từ field
//   `evidenceId` đơn sang quan hệ 1:N `evidenceIds: string[]` — `PUT /deposits/:id` giờ nhận thêm
//   `evidenceIds` (ghi kèm cùng lúc đổi `status`, KHÔNG có cách gắn bằng chứng riêng lẻ mà không đổi
//   trạng thái, vì endpoint chỉ cho gọi khi deposit còn UNPAID).

export type DepositStatus = 'UNPAID' | 'PAID' | 'CANCELLED';

// GET /api/v1/orders/:id/deposits
export interface Deposit {
  depositId: string;
  depositCode: string;
  orderId: string;
  amount: number;
  dueDate?: string;
  paymentDate?: string;
  paymentMethod?: string;
  qrCodeUrl?: string;
  status: DepositStatus;
  evidenceIds: string[];
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// POST /api/v1/orders/:id/deposits
export interface CreateOrderDepositPayload {
  amount: number;
  paymentMethod?: string;
  notes?: string;
  dueDate?: string; // ISO datetime — xác nhận hoạt động qua curl 2026-07-21
}

// PUT /api/v1/deposits/:id — khi status=PAID, backend tự set approvedBy/approvedAt/paymentDate
// và cập nhật Order.paymentStatus = DEPOSITED. `notes` khai ở đây nhưng bị bỏ qua hoàn toàn ở mọi
// status (xác nhận qua curl 2026-07-21) — chỉ `status`/`evidenceIds` thật sự được ghi, giữ field
// `notes` trong type để không phá interface hiện có nếu backend fix lại sau, nhưng FE không nên hiển
// thị UI ngụ ý field này có tác dụng (vd không cho nhập ghi chú ở bước xác nhận/hủy).
export interface UpdateDepositStatusPayload {
  status: DepositStatus;
  notes?: string;
  evidenceIds?: string[];
}
