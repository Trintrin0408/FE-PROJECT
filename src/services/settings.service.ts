import api from './api';
import type { Bank, CompanyBankAccount, GetTransactionsQuery, TransactionListResult, UpdateBankAccountPayload } from '@/types/settings';

export const settingsApiService = {
  /** GET /api/v1/settings/bank-account — mọi role đăng nhập đọc được (dựng QR). */
  async getBankAccount(): Promise<CompanyBankAccount> {
    const response = await api.get('/settings/bank-account');
    return (response.data?.data ?? response.data) as CompanyBankAccount;
  },

  /** PUT /api/v1/settings/bank-account — chỉ ADMIN cấu hình. */
  async updateBankAccount(payload: UpdateBankAccountPayload): Promise<CompanyBankAccount> {
    const response = await api.put('/settings/bank-account', payload);
    return (response.data?.data ?? response.data) as CompanyBankAccount;
  },

  /** GET /api/v1/settings/transactions — proxy SePay list transactions (Manager/Admin). */
  async getTransactions(params?: GetTransactionsQuery): Promise<TransactionListResult> {
    const response = await api.get('/settings/transactions', { params });
    return (response.data?.data ?? response.data) as TransactionListResult;
  },

  /** GET /api/v1/settings/banks — danh sách ngân hàng (proxy banks.json) để chọn khi cấu hình. */
  async getBanks(): Promise<Bank[]> {
    const response = await api.get('/settings/banks');
    return (response.data?.data ?? response.data) as Bank[];
  },
};
