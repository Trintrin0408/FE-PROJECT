import type { SettlementStatus } from '@/types/settlement';
import type { BadgeVariant } from '@/components/ui/Badge';

// Nhãn hiển thị cho Settlement.status thật (3 giá trị kể từ backend refactor 2026-07-26) — luồng UI
// hiện có: POST .../settlement luôn tạo UNPAID, PUT .../confirm chuyển PAID (xem
// RecordSettlementModal.tsx/SettlementDetailView.tsx).
export const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã xác nhận quyết toán',
  CANCELLED: 'Đã hủy',
};

export const SETTLEMENT_STATUS_VARIANT: Record<SettlementStatus, BadgeVariant> = {
  UNPAID: 'warning',
  PAID: 'success',
  CANCELLED: 'error',
};
