import { Plus } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import type { Deposit } from '@/types/payment';

const STATUS_LABEL: Record<Deposit['status'], string> = {
  UNPAID: 'Chờ xử lý',
  PAID: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
};

interface PaymentHistoryCardProps {
  deposits: Deposit[];
  totalDue: number;
  isLoading: boolean;
  onOpenRequestPayment: () => void;
}

export default function PaymentHistoryCard({
  deposits,
  totalDue,
  isLoading,
  onOpenRequestPayment,
}: Readonly<PaymentHistoryCardProps>) {
  const totalCollected = deposits.filter((d) => d.status === 'PAID').reduce((sum, d) => sum + Number(d.amount), 0);
  const progressPercent = totalDue > 0 ? Math.min(100, Math.round((totalCollected / totalDue) * 100)) : 0;

  const columns: TableColumn<Deposit>[] = [
    { key: 'amount', label: 'Số tiền', render: (row) => <span className="font-bold text-slate-900">{formatCurrency(row.amount)}</span> },
    { key: 'paymentMethod', label: 'Phương thức', render: (row) => row.paymentMethod ?? '—' },
    { key: 'paymentDate', label: 'Ngày', render: (row) => (row.paymentDate ? formatDate(row.paymentDate) : '—') },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => <Badge variant={getStatusBadgeVariant(row.status)}>{STATUS_LABEL[row.status] ?? row.status}</Badge>,
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Lịch sử tiền cọc</h3>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs font-bold uppercase text-slate-400">Đã thu / Tổng</p>
            <p className="text-sm font-bold text-slate-900">
              {formatCurrency(totalCollected)} / {formatCurrency(totalDue)}
            </p>
          </div>
          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-green-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="mb-6">
        <Table columns={columns} rows={deposits} rowKey={(row) => row.depositId} isLoading={isLoading} emptyText="Chưa có tiền cọc nào" />
      </div>

      <Button onClick={onOpenRequestPayment}>
        <Plus className="h-4 w-4" />
        Ghi nhận tiền cọc mới
      </Button>
    </div>
  );
}
