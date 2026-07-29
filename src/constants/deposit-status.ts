import type { DepositStatus } from '@/types/payment';

// Nhãn hiển thị cho Deposit.status thật (3 giá trị kể từ backend refactor 2026-07-26, khác 2 giá trị
// RECEIVED/PENDING của mock cũ src/mocks/db/payments.ts — file mock đó vẫn giữ nguyên vì màn
// "Thanh toán"/Settlement khác dùng chung, chỉ màn "Đặt cọc" đổi sang dùng file này). Màu theo
// CLAUDE.md mục 3 (xanh lá=thành công, vàng=chờ xử lý, xám=không hoạt động) — ánh xạ variant ở
// getStatusBadgeVariant (components/ui/Badge.tsx) đã có sẵn PAID/UNPAID/CANCELLED.
export const DEPOSIT_STATUS_LABEL: Record<DepositStatus, string> = {
  UNPAID: 'Chờ thanh toán',
  PAID: 'Đã nhận cọc',
  CANCELLED: 'Đã hủy yêu cầu',
};

// Deposit.paymentMethod là varchar(100) tự do trên DB (không phải cột enum) — vẫn giữ danh sách gợi ý
// cố định ở FE để tránh gửi giá trị rác, đúng khuyến nghị docs/datcoc_api.md mục 3.
export const PAYMENT_METHOD_OPTIONS = [
  { value: 'bank_transfer', label: 'Chuyển khoản Ngân hàng' },
  { value: 'cash', label: 'Tiền mặt' },
];

export function paymentMethodLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
