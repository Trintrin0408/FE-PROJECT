'use client';

import { useEffect, useState } from 'react';
import { Package, User } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { AddressAutocompleteInput } from '@/components/ui/AddressAutocompleteInput';
import { EVENT_TYPES } from '@/constants/order-event-type';
import { orderApiService } from '@/services/order.service';
import { parseApiError } from '@/utils/apiError';
import type { OrderDetail } from '@/types/order';
import toast from 'react-hot-toast';

// PATCH /api/v1/orders/:orderId — sửa eventName/eventType/guestCount/location/notes của Order đã tồn
// tại. Không gồm eventDate/endDate — dùng riêng nút "Đổi ngày" (RescheduleOrderModal) để tránh xung đột
// luồng khóa kho theo ngày.

const EVENT_TYPE_OPTIONS = EVENT_TYPES.map((t) => ({ value: t, label: t }));

interface EditOrderModalProps {
  isOpen: boolean;
  order: OrderDetail;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditOrderModal({ isOpen, order, onClose, onSuccess }: Readonly<EditOrderModalProps>) {
  const [eventName, setEventName] = useState('');
  const [eventType, setEventType] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEventName(order.eventName ?? '');
    setEventType(order.eventType ?? '');
    setGuestCount(order.guestCount ? String(order.guestCount) : '');
    setLocation(order.location ?? '');
    setLatitude(order.latitude);
    setLongitude(order.longitude);
    setNotes(order.notes ?? '');
    setErrors({});
    setSubmitError(null);
  }, [isOpen, order]);

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!eventType) next.eventType = 'Vui lòng chọn loại sự kiện';
    if (!location.trim()) next.location = 'Vui lòng nhập địa điểm tổ chức';
    if (guestCount && Number(guestCount) < 1) next.guestCount = 'Số lượng khách phải lớn hơn 0';
    return next;
  };

  const handleSubmit = async () => {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await orderApiService.updateOrderInfo(order.orderId, {
        eventName: eventName.trim() || undefined,
        eventType,
        guestCount: guestCount ? Number(guestCount) : undefined,
        location: location.trim(),
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
        notes: notes.trim() || undefined,
      });
      toast.success('Đã lưu thay đổi đơn đặt.');
      onClose();
      onSuccess();
    } catch (err) {
      setSubmitError(parseApiError(err, 'Không lưu được thay đổi, vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Chỉnh sửa đơn đặt · ${order.orderCode}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} isLoading={submitting}>
            Lưu thay đổi
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">Thông tin khách hàng</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 sm:grid-cols-2">
            <span>
              <span className="text-slate-400">Khách hàng: </span>
              {order.customerName}
            </span>
            <span>
              <span className="text-slate-400">SĐT: </span>
              {order.customerPhone}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">Không đổi được khách hàng liên kết của đơn đã tạo.</p>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <div className="mb-3 flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">Thông tin đơn hàng</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input
                label="Tên sự kiện"
                placeholder="VD: Lễ cưới Anh Tuấn & Chị Hoa"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
            </div>
            <Select
              label="Loại sự kiện"
              required
              error={errors.eventType}
              placeholder="Chọn loại sự kiện"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              options={EVENT_TYPE_OPTIONS}
            />
            <Input
              type="number"
              label="Số lượng khách"
              min={1}
              placeholder="VD: 200"
              value={guestCount}
              error={errors.guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
            />
            <div className="sm:col-span-2">
              <AddressAutocompleteInput
                label="Địa điểm tổ chức"
                required
                placeholder="VD: 123 Đường ABC, Quận 1, TP.HCM"
                value={location}
                error={errors.location}
                onChange={(value) => {
                  setLocation(value);
                  setLatitude(undefined);
                  setLongitude(undefined);
                }}
                onSelectPlace={({ formattedAddress, lat, lng }) => {
                  setLocation(formattedAddress);
                  setLatitude(lat);
                  setLongitude(lng);
                }}
              />
            </div>
            <div className="sm:col-span-2">
              <Textarea
                id="edit-order-notes"
                label="Ghi chú"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      </div>
    </Modal>
  );
}
