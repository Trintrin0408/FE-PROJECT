'use client';

import TransactionHistoryView from '@/components/settings/TransactionHistoryView';

// Lịch sử giao dịch (Admin) — đọc từ tài khoản Admin đã cấu hình (proxy SePay qua BE).
export default function Page() {
  return <TransactionHistoryView />;
}
