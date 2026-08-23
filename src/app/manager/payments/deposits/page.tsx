'use client';

import DepositListView from '@/components/payments/DepositListView';

// Nối API thật theo docs/datcoc_api.md — xem giải thích chi tiết + N+1 tạm thời ở
// components/payments/DepositListView.tsx. Tách riêng khỏi màn "Thanh toán" (quyết toán cuối kỳ,
// /manager/payments/settlements) theo yêu cầu người dùng — vẫn còn mock, ngoài phạm vi lần nối này.
export default function Page() {
  return <DepositListView detailBasePath="/manager/payments/deposits" showDetailAction={false} />;
}
