'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/utils/formatDate';
import { formatCurrency } from '@/utils/formatCurrency';
import { orderApiService } from '@/services/order.service';
import { policyApiService } from '@/services/policy.service';
import type { OrderDetail } from '@/types/order';
import type { BusinessPolicy } from '@/types/policy';

interface CancelOrderModalProps {
  isOpen: boolean;
  order: OrderDetail;
  customerName: string;
  /** Tổng tiền đã thu thật (payments status = success) — dùng để ước tính số tiền hoàn, không phải để gửi lên API. */
  depositCollected: number;
  onClose: () => void;
  onSuccess: () => void;
}

// Fallback khi chưa tải xong (hoặc backend chưa có đủ) chính sách CANCELLATION — khớp đúng 3 mốc
// mặc định ở CLAUDE.md mục 1 (≥30 ngày: 100%, 7-30 ngày: 50%, <7 ngày: 0%).
const DEFAULT_REFUND_TIERS: RefundTier[] = [
  { minDays: 30, refundPercent: 100, label: 'Hoàn 100% tiền cọc' },
  { minDays: 7, refundPercent: 50, label: 'Hoàn 50% tiền cọc' },
  { minDays: -Infinity, refundPercent: 0, label: 'Không hoàn cọc' },
];

interface RefundTier {
  minDays: number;
  refundPercent: number;
  label: string;
}

// Đọc tỉ lệ hoàn cọc (%) động từ các chính sách CANCELLATION đang áp dụng (/admin/policies) thay vì
// hard-code 100/50/0 — xem docs/admin_chinhsach_api.md mục 6.3. Mốc số ngày (30/7) vẫn là hằng số
// nghiệp vụ cố định vì BusinessPolicy hiện chưa có field ngưỡng ngày cấu trúc (chỉ có trong
// policyName/description dạng text) — chỉ giá trị % và nhãn hiển thị đọc động theo policyValue/policyName,
// xếp theo policyValue giảm dần (tỉ lệ hoàn cao nhất ứng với số ngày còn lại nhiều nhất).
function buildRefundTiers(cancellationPolicies: BusinessPolicy[]): RefundTier[] {
  if (cancellationPolicies.length < 3) return DEFAULT_REFUND_TIERS;
  const [full, partial, none] = [...cancellationPolicies].sort((a, b) => b.policyValue - a.policyValue);
  return [
    { minDays: 30, refundPercent: full.policyValue, label: full.policyName },
    { minDays: 7, refundPercent: partial.policyValue, label: partial.policyName },
    { minDays: -Infinity, refundPercent: none.policyValue, label: none.policyName },
  ];
}

// Đây chỉ là ước tính hiển thị cho Manager tham khảo — hệ thống không tự động xử lý hoàn tiền.
function getRefundPolicyPreview(eventDate: string, tiers: RefundTier[]): { daysLeft: number; refundPercent: number; label: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(eventDate);
  event.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((event.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const tier = tiers.find((t) => daysLeft >= t.minDays) ?? tiers[tiers.length - 1];
  return { daysLeft, refundPercent: tier.refundPercent, label: tier.label };
}

export default function CancelOrderModal({
  isOpen,
  order,
  customerName,
  depositCollected,
  onClose,
  onSuccess,
}: Readonly<CancelOrderModalProps>) {
  const [reason, setReason] = useState('');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refundTiers, setRefundTiers] = useState<RefundTier[]>(DEFAULT_REFUND_TIERS);

  useEffect(() => {
    if (!isOpen) return;
    policyApiService.getPolicies({ policyType: 'CANCELLATION', isActive: true }).then((res) => {
      setRefundTiers(buildRefundTiers(res.data));
    });
  }, [isOpen]);

  const policy = getRefundPolicyPreview(order.eventDate, refundTiers);
  const estimatedRefund = Math.round((depositCollected * policy.refundPercent) / 100);

  const resetAndClose = () => {
    setReason('');
    setConfirmChecked(false);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do hủy đơn.');
      return;
    }
    if (!confirmChecked) {
      setError('Vui lòng xác nhận hủy đơn và giải phóng kho.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await orderApiService.updateOrderStatus(order.orderId, {
        orderStatus: 'CANCELLED',
        cancelReason: reason.trim(),
      });
      onSuccess();
      resetAndClose();
    } catch {
      setError('Không thể hủy đơn hàng. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Hủy bỏ đơn hàng & giải phóng kho"
      footer={
        <>
          <Button variant="secondary" onClick={resetAndClose} disabled={isSubmitting}>
            Giữ lại đơn (không hủy)
          </Button>
          <Button variant="danger" onClick={handleSubmit} isLoading={isSubmitting}>
            Xác nhận hủy đơn hàng
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex gap-2 rounded-lg bg-red-50 p-3 text-xs font-medium leading-relaxed text-red-600">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            Hệ thống chỉ đổi trạng thái đơn hàng sang &quot;Đã hủy&quot; — KHÔNG tự động giải phóng lịch
            khảo sát/thi công hay hoàn thiết bị về kho. Manager cần tự xử lý các phần này thủ công sau khi
            hủy đơn.
          </span>
        </div>

        <div className="space-y-1 rounded-lg border border-slate-200 p-3">
          <p>
            <span className="font-semibold text-slate-500">Mã đơn hàng:</span> #{order.orderId}
          </p>
          <p>
            <span className="font-semibold text-slate-500">Khách hàng:</span> {customerName}
          </p>
          <p>
            <span className="font-semibold text-slate-500">Ngày sự kiện:</span> {formatDate(order.eventDate)}
            {order.endDate ? ` - ${formatDate(order.endDate)}` : ''}
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
          <p className="font-bold text-amber-800">
            {policy.daysLeft >= 0 ? `Còn ${policy.daysLeft} ngày tới sự kiện` : 'Đã quá ngày sự kiện'} — {policy.label}
          </p>
          {depositCollected > 0 && (
            <p className="mt-1 text-amber-700">
              Tiền cọc đã thu: <span className="font-semibold">{formatCurrency(depositCollected)}</span> · Ước tính hoàn
              khách: <span className="font-semibold">{formatCurrency(estimatedRefund)}</span>
            </p>
          )}
          <p className="mt-1 text-amber-600">
            Đây chỉ là số liệu ước tính theo chính sách hoàn cọc chung — việc hoàn tiền thực tế Manager thực hiện thủ
            công ngoài hệ thống.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="cancel-reason" className="font-semibold text-slate-700">
            Lý do hủy đơn <span className="text-red-500">*</span>
          </label>
          <textarea
            id="cancel-reason"
            required
            rows={3}
            placeholder="Nhập lý do khách quan/chủ quan hủy hợp đồng..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <label className="flex select-none items-start gap-2.5 text-xs font-medium leading-relaxed text-slate-600">
          <input
            type="checkbox"
            checked={confirmChecked}
            onChange={(e) => setConfirmChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded text-red-600 focus:ring-red-500"
          />
          <span>Tôi xác nhận hủy đơn, đồng ý thực hiện theo đúng chính sách đền bù/hoàn cọc và giải phóng thiết bị đã giữ.</span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
