'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarClock } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { orderApiService } from '@/services/order.service';
import { parseApiError } from '@/utils/apiError';
import { toDateInputValue } from '@/utils/formatDate';

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

  useEffect(() => {
    if (isOpen) {
      setEventDate(toDateInputValue(currentEventDate));
      setEndDate(currentEndDate ? toDateInputValue(currentEndDate) : toDateInputValue(currentEventDate));
      setError(null);
    }
  }, [isOpen, currentEventDate, currentEndDate]);

  // Chính sách: đổi ngày miễn phí nếu >3 ngày trước ngày sự kiện; trong ≤3 ngày có thể phát sinh phí.
  const todayKey = toDateInputValue(Date.now());
  const daysToEvent = Math.round(
    (new Date(`${toDateInputValue(currentEventDate)}T12:00:00Z`).getTime() - new Date(`${todayKey}T12:00:00Z`).getTime()) / 86_400_000,
  );
  const feeWarning = daysToEvent <= 3;

  const handleSubmit = async () => {
    if (!eventDate) {
      setError('Vui lòng chọn ngày sự kiện mới.');
      return;
    }
    if (endDate && endDate < eventDate) {
      setError('Ngày kết thúc phải >= ngày sự kiện.');
      return;
    }
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
      setError(parseApiError(err, 'Không đổi được ngày — có thể ngày mới trùng khoảng thiếu thiết bị.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Đổi ngày sự kiện — ${orderCode}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} isLoading={submitting}>
            <CalendarClock className="h-4 w-4" /> Xác nhận đổi ngày
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Đổi ngày sẽ <span className="font-semibold">tự dời cửa sổ giữ chỗ thiết bị</span> theo ngày mới. Nếu ngày mới trùng
          khoảng đã kín hàng, hệ thống sẽ chặn (báo thiết bị thiếu).
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input type="date" label="Ngày sự kiện mới" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          <Input type="date" label="Ngày kết thúc" min={eventDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        {feeWarning && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            ⚠️ Còn {daysToEvent < 0 ? 0 : daysToEvent} ngày tới sự kiện — đổi ngày trong ≤3 ngày có thể phát sinh phí (xử lý ở
            bước quyết toán). Trên 3 ngày thì miễn phí.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
