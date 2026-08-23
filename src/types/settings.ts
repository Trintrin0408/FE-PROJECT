// Tài khoản ngân hàng công ty — cấu hình bởi Admin (GET/PUT /settings/bank-account). Dùng để sinh mã QR
// SePay/VietQR nhận cọc & quyết toán. `configured` = đã nhập đủ (có mã NH + số TK) → mới dựng được QR.
export interface CompanyBankAccount {
  bankBin: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  configured: boolean;
  updatedAt: string | null;
}

export interface UpdateBankAccountPayload {
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

// ── Lịch sử giao dịch (proxy SePay v2 qua BE GET /settings/transactions) ──
export interface SepayTransaction {
  id: string;
  transactionDate: string | null;
  accountNumber: string | null;
  bankBrandName: string | null;
  transferType: string | null; // 'in' | 'out'
  amountIn: number;
  amountOut: number;
  accumulated: number;
  content: string | null;
  referenceNumber: string | null;
  code: string | null;
}

export interface TransactionListResult {
  configured: boolean; // đã cấu hình token SePay + tài khoản
  data: SepayTransaction[];
  meta: { page: number; perPage: number; total: number; totalPages: number; hasMore: boolean };
}

export interface GetTransactionsQuery {
  page?: number;
  perPage?: number;
  transferType?: 'in' | 'out';
  dateFrom?: string;
  dateTo?: string;
  q?: string;
}

// Ngân hàng (từ banks.json VietQR/SePay, proxy qua BE GET /settings/banks) — để Admin chọn khi cấu hình.
export interface Bank {
  bin: string;
  code: string;
  shortName: string;
  name: string;
}
