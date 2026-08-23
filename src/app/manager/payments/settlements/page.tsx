'use client';

import SettlementListView from '@/components/payments/SettlementListView';

// Nối API thật (2026-07-21) — xem giải thích ở đầu SettlementListView.tsx. Trang mỏng chỉ tham số hóa
// route cho vai trò Manager (đầy đủ lập/xác nhận quyết toán ở trang chi tiết).
export default function Page() {
  return <SettlementListView detailBasePath="/manager/payments/settlements" showDetailAction={false} />;
}
