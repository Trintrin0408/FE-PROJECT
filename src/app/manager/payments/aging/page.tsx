'use client';

import { AlertCircle, Clock, Wallet } from 'lucide-react';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import PaymentAgingBoard from '@/components/dashboard/PaymentAgingBoard';
import { usePaymentAging } from '@/hooks/usePaymentAging';
import { formatCurrency } from '@/utils/formatCurrency';

export default function PaymentAgingPage() {
  const { isLoading, loadError, rows, unpaidCount, settlementOverdue, outstandingValue } = usePaymentAging();

  const kpis: KpiCardItem[] = [
    { label: 'Đơn chưa thu cọc', value: unpaidCount, icon: AlertCircle, iconColor: 'pink', changeDirection: unpaidCount > 0 ? 'down' : 'up' },
    { label: 'Quá hạn quyết toán', value: settlementOverdue, icon: Clock, iconColor: 'amber', changeDirection: settlementOverdue > 0 ? 'down' : 'up' },
    { label: 'Tổng giá trị đang treo', value: formatCurrency(outstandingValue), icon: Wallet, iconColor: 'blue' },
  ];

  return (
    <div className="p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Công nợ &amp; dòng tiền</h1>
        <p className="mt-1 text-sm text-slate-500">
          Đơn đang treo tiền theo mức gấp so với ngày sự kiện — thu cọc trước hạn, quyết toán sau sự kiện đúng lúc.
        </p>
      </div>

      {loadError && <div className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{loadError}</div>}

      <div className="mt-6">
        <DashboardStats items={kpis} />
      </div>

      <div className="mt-6">
        <PaymentAgingBoard rows={rows} isLoading={isLoading} />
      </div>
    </div>
  );
}
