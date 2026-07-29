'use client';

import DepositListView from '@/components/payments/DepositListView';

// Nối API thật theo docs/datcoc_api.md — trang Admin dùng chung DepositListView với Manager (bảng
// thuần đọc, không có thao tác ghi nào ở màn danh sách nên không cần phân biệt quyền ở đây).
export default function Page() {
  return <DepositListView detailBasePath="/admin/orders_audit/payments" />;
}
