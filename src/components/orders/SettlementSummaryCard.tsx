import AnalyticsCard from '@/components/dashboard/AnalyticsCard';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/utils/formatCurrency';
import type { Settlement } from '@/types/settlement';

const STATUS_LABEL: Record<Settlement['status'], string> = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
};

interface SettlementSummaryCardProps {
  settlement: Settlement | null;
  orderTotal: number;
  depositCollected: number;
  canManage: boolean;
  isSubmitting: boolean;
  onOpenRecordSettlement: () => void;
  onConfirmSettlement: () => void;
}

// Backend mới chỉ có 1 bản ghi Settlement phẳng (additionalFee/compensation/discount/finalAmount),
// server tự tính finalAmount — KHÔNG còn breakdown từng dòng phụ thu/bồi thường (SettlementLine đã
// bị xoá khỏi schema) — xem docs/more-require.md.
export default function SettlementSummaryCard({
  settlement,
  orderTotal,
  depositCollected,
  canManage,
  isSubmitting,
  onOpenRecordSettlement,
  onConfirmSettlement,
}: Readonly<SettlementSummaryCardProps>) {
  const isConfirmed = settlement?.status === 'PAID';

  return (
    <AnalyticsCard title="Quyết toán" isPlaceholder>
      <div className="mb-4 flex justify-end">
        {settlement ? (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isConfirmed ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
            }`}
          >
            {STATUS_LABEL[settlement.status].toUpperCase()}
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">CHƯA QUYẾT TOÁN</span>
        )}
      </div>

      {!settlement ? (
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Giá trị đơn hàng:</span>
            <span className="font-semibold">{formatCurrency(orderTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Đã cọc:</span>
            <span className="font-semibold text-green-600">-{formatCurrency(depositCollected)}</span>
          </div>
          {canManage && (
            <Button onClick={onOpenRecordSettlement}>Lập biên bản quyết toán</Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Giá trị đơn hàng:</span>
            <span className="font-semibold">{formatCurrency(orderTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Phụ thu phát sinh:</span>
            <span className="font-semibold text-orange-600">+{formatCurrency(settlement.additionalFee)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Bồi thường hư hỏng:</span>
            <span className="font-semibold text-orange-600">+{formatCurrency(settlement.compensation)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Giảm trừ/Ưu đãi:</span>
            <span className="font-semibold text-green-600">-{formatCurrency(settlement.discount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Đã cọc:</span>
            <span className="font-semibold text-green-600">-{formatCurrency(depositCollected)}</span>
          </div>
          <div className="flex items-center justify-between border-t-2 border-slate-900 pt-4">
            <span className="text-lg font-extrabold text-slate-900">Cần thu cuối:</span>
            <span className="text-2xl font-extrabold text-blue-600">{formatCurrency(settlement.finalAmount)}</span>
          </div>

          {canManage && !isConfirmed && (
            <Button className="w-full" disabled={isSubmitting} onClick={onConfirmSettlement}>
              Xác nhận quyết toán
            </Button>
          )}
        </div>
      )}
    </AnalyticsCard>
  );
}
