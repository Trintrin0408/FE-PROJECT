import type { BadgeVariant } from '@/components/ui/Badge';

// Nhãn + màu badge cho SupplierTransaction.status/transactionType/paymentStatus — theo đúng schema DB
// thật do người dùng cung cấp trực tiếp ngày 2026-07-30 (bảng supplier_transactions), khớp với
// UpdateSupplierTransactionModal.tsx (component thật đang hoạt động). Không dùng type từ
// @/types/procurement — enum SupplierTransactionStatus ở đó ghi `IN_PROGRESS` là SAI, giá trị đúng theo
// DB thật là `RECEIVED`. Không dùng getStatusBadgeVariant() (components/ui/Badge.tsx) — helper đó dùng
// chung nhiều domain khác nhau, cho PENDING/APPROVED màu khác quy ước đã dùng thật ở
// SupplierDetailView.tsx, và không có key RECEIVED — hardcode màu riêng cho đúng domain này.
export type SupplierTransactionStatus = 'PENDING' | 'APPROVED' | 'RECEIVED' | 'COMPLETED' | 'CANCELLED';
export type SupplierTransactionType = 'RENTAL' | 'PURCHASE';
export type SupplierTransactionPaymentStatus = 'UNPAID' | 'DEPOSITED' | 'PAID';

export const SUPPLIER_TRANSACTION_STATUS_META: Record<SupplierTransactionStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Chờ duyệt', variant: 'neutral' },
  APPROVED: { label: 'Đã duyệt', variant: 'info' },
  RECEIVED: { label: 'Đã nhận', variant: 'success' },
  COMPLETED: { label: 'Hoàn thành', variant: 'success' },
  CANCELLED: { label: 'Đã hủy', variant: 'error' },
};

export const SUPPLIER_TRANSACTION_TYPE_META: Record<SupplierTransactionType, { label: string; variant: BadgeVariant }> = {
  RENTAL: { label: 'Thuê ngoài', variant: 'neutral' },
  PURCHASE: { label: 'Mua hàng', variant: 'neutral' },
};

export const SUPPLIER_TRANSACTION_PAYMENT_STATUS_META: Record<SupplierTransactionPaymentStatus, { label: string; variant: BadgeVariant }> = {
  UNPAID: { label: 'Chưa thanh toán', variant: 'warning' },
  DEPOSITED: { label: 'Đã đặt cọc', variant: 'warning' },
  PAID: { label: 'Đã thanh toán', variant: 'success' },
};

// Máy trạng thái forward-only — KHỚP guard phía BE (supplier.service.updateTransactionStatus): mỗi trạng
// thái hiện tại → các trạng thái hợp lệ có thể chuyển tới. COMPLETED/CANCELLED là điểm cuối (rỗng). Nguồn
// chân lý duy nhất để dựng nút thao tác (SupplierTransactionStatusActions) — không hardcode rải rác nữa.
export const SUPPLIER_TRANSACTION_NEXT_STATUSES: Record<SupplierTransactionStatus, SupplierTransactionStatus[]> = {
  PENDING: ['APPROVED', 'CANCELLED'],
  APPROVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};
