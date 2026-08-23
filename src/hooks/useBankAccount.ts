'use client';

import { useEffect, useState } from 'react';
import { settingsApiService } from '@/services/settings.service';
import type { CompanyBankAccount } from '@/types/settings';

// Lấy tài khoản ngân hàng công ty (Admin cấu hình) để dựng mã QR SePay ở trang cọc/quyết toán.
export function useBankAccount() {
  const [account, setAccount] = useState<CompanyBankAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    settingsApiService
      .getBankAccount()
      .then((a) => {
        if (!cancelled) setAccount(a);
      })
      .catch(() => {
        if (!cancelled) setAccount(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { account, isLoading };
}
