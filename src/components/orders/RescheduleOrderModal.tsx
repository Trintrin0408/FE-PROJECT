'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CalendarClock, PackageX } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { orderApiService } from '@/services/order.service';
import { parseApiError } from '@/utils/apiError';
import { formatDate, toDateInputValue } from '@/utils/formatDate';

interface RescheduleOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderCode: string;
  currentEventDate: string;
  currentEndDate?: string | null;
  onSuccess: () => void;
}

/** Đổi ngày sự kiện — đơn đã chốt sẽ tự dời cửa sổ giữ chỗ thiết bị (BE 409 nếu ngày mới trùng khoảng thiếu hàng). */
export default function RescheduleOrderModal({
  isOpen,
  onClose,
  orderId,
  orderCode,
  currentEventDate,
  currentEndDate,
  onSuccess,
}: RescheduleOrderModalProps) {
  const [eventDate, setEventDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEventDate(toDateInputValue(currentEventDate));
      setEndDate(currentEndDate ? toDateInputValue(currentEndDate) : toDateInputValue(currentEventDate));
      setError(null);
      setConfirmStep(false);
    }
  }, [isOpen, currentEventDate, currentEndDate]);

  // Chính sách: đổi ngày miễn phí nếu >3 ngày trước ngày sự kiện; trong ≤3 ngày có thể phát sinh phí.
  const todayKey = toDateInputValue(Date.now());
  const daysToEvent = Math.round(
    (new Date(`${toDateInputValue(currentEventDate)}T12:00:00Z`).getTime() - new Date(`${todayKey}T12:00:00Z`).getTime()) / 86_400_000,
  );
  const feeWarning = daysToEvent <= 3;

  const handleRequestConfirm = () => {
    if (!eventDate) {
      setError('Vui lòng chọn ngày sự kiện mới.');
      return;
    }
    if (endDate && endDate < eventDate) {
      setError('Ngày kết thúc phải >= ngày sự kiện.');
      return;
    }
    setError(null);
    setConfirmStep(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await orderApiService.updateOrderDates(orderId, {
        eventDate: new Date(`${eventDate}T00:00:00`).toISOString(),
        endDate: endDate ? new Date(`${endDate}T00:00:00`).toISOString() : undefined,
      });
      toast.success(`Đã đổi ngày cho đơn ${orderCode}.`);
      onClose();
      onSuccess();
    } catch (err) {
      setError(parseApiError(err, 'Không đổi được ngày - có thể ngày mới trùng khoảng thiếu thiết bị.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={confirmStep ? `Xác nhận đổi ngày — ${orderCode}` : `Đổi ngày sự kiện — ${orderCode}`}
      footer={
        confirmStep ? (
          <>
            <Button variant="secondary" onClick={() => setConfirmStep(false)} disabled={submitting}>
              Quay lại
            </Button>
            <Button onClick={handleSubmit} isLoading={submitting}>
              <CalendarClock className="h-4 w-4" /> Xác nhận đổi ngày
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Hủy
            </Button>
            <Button onClick={handleRequestConfirm}>
              <CalendarClock className="h-4 w-4" /> Xác nhận đổi ngày
            </Button>
          </>
        )
      }
    >
      {confirmStep ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Ngày sự kiện</span>
              <span>
                <span className="text-slate-400 line-through">{formatDate(currentEventDate)}</span>{' '}
                <span className="font-semibold text-slate-900">→ {formatDate(new Date(`${eventDate}T00:00:00`).toISOString())}</span>
              </span>
            </div>
            {endDate && (
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="text-slate-500">Ngày kết thúc</span>
                <span className="font-semibold text-slate-900">{formatDate(new Date(`${endDate}T00:00:00`).toISOString())}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            <PackageX className="h-4 w-4 shrink-0" />
            <span>
              Cửa sổ giữ chỗ thiết bị sẽ được dời theo ngày mới. Nếu ngày mới trùng khoảng đã kín hàng, hệ thống sẽ báo{' '}
              <span className="font-semibold">thiếu thiết bị</span> và không đổi được - hãy kiểm tra tồn kho trước khi xác nhận.
            </span>
          </div>

          {feeWarning && (
            <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Còn {daysToEvent < 0 ? 0 : daysToEvent} ngày tới sự kiện - đổi ngày trong ≤3 ngày có thể phát sinh phí (xử lý ở
                bước quyết toán). Trên 3 ngày thì miễn phí.
              </span>
            </div>
          )}

          <p className="text-sm text-slate-600">Bạn có chắc chắn muốn đổi ngày cho đơn này không?</p>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input type="date" label="Ngày sự kiện mới" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            <Input type="date" label="Ngày kết thúc" min={eventDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          {feeWarning && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              ⚠️ Còn {daysToEvent < 0 ? 0 : daysToEvent} ngày tới sự kiện - đổi ngày trong ≤3 ngày có thể phát sinh phí (xử lý ở
              bước quyết toán). Trên 3 ngày thì miễn phí.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
