import type { BadgeVariant } from '@/components/ui/Badge';
import { getStatusBadgeVariant } from '@/components/ui/Badge';
import type { SupplierTransactionStatus, SupplierTransactionType } from '@/types/procurement';

// Nhãn hiển thị cho SupplierTransaction.status/transactionType — theo enum thật của backend, xác nhận
// qua curl GET /api/v1/supplier-transactions ngày 2026-07-21 (docs/supplier_api.md mục 4.2/6.0).
export const SUPPLIER_TRANSACTION_STATUS_META: Record<SupplierTransactionStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Chờ duyệt', variant: getStatusBadgeVariant('PENDING') },
  APPROVED: { label: 'Đã duyệt', variant: getStatusBadgeVariant('APPROVED') },
  IN_PROGRESS: { label: 'Đang thực hiện', variant: getStatusBadgeVariant('IN_PROGRESS') },
  COMPLETED: { label: 'Hoàn thành', variant: getStatusBadgeVariant('COMPLETED') },
  CANCELLED: { label: 'Đã hủy', variant: getStatusBadgeVariant('CANCELLED') },
};

export const SUPPLIER_TRANSACTION_TYPE_META: Record<SupplierTransactionType, { label: string }> = {
  RENTAL: { label: 'Thuê' },
  PURCHASE: { label: 'Mua' },
};
