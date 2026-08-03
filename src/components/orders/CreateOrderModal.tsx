'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AxiosError } from 'axios';
import { Package, User } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { AddressAutocompleteInput } from '@/components/ui/AddressAutocompleteInput';
import { orderApiService } from '@/services/order.service';
import { EVENT_TYPES } from '@/constants/order-event-type';
import { VN_TIME_ZONE } from '@/utils/formatDate';
import type { Customer } from '@/types/customer';

// Nối API thật theo docs/taodondatlichtiecmoi_api.md mục 3 (Hướng A) — wire vào nút "Khởi tạo đơn đặt
// hàng" ở manager/orders/page.tsx và admin/orders_audit/page.tsx (2026-07-20). Component này đã đúng
// shape `CreateOrderPayload` từ trước (customerId/eventType/eventDate ISO/location/guestCount/items[]),
// chỉ còn thiếu ở lần nối trước là chưa được import ở đâu — không cần sửa logic tạo đơn.
//
// Cập nhật 2026-07-21 (theo yêu cầu người dùng): bỏ hẳn khối "Hạng mục thiết bị/dịch vụ" khỏi bước tạo
// đơn — Manager chỉ khởi tạo thông tin khách hàng/sự kiện ở bước này (order = NEW, payment = UNPAID),
// hạng mục thiết bị được quyết định sau ở bước khảo sát/báo giá rồi gắn vào đơn qua "Tạo báo giá liên
// kết"/"Liên kết báo giá đã duyệt" ở tab "Báo giá & Hợp đồng" (đã nối API thật, xem
// `manager/orders/[id]/page.tsx`, dùng `PATCH /orders/:orderId/quotation` + `PUT /orders/:orderId/items`
// để đồng bộ items từ báo giá). `items` gửi lên `POST /orders` ở đây luôn là mảng rỗng — backend thật
// (`createOrderSchema`) hiện bắt buộc tối thiểu 1 phần tử, cần Backend nới lỏng ràng buộc này (xem
// docs/more-require.md mục (ag)) trước khi luồng này chạy được không lỗi 400.

const EVENT_TYPE_OPTIONS = EVENT_TYPES.map((t) => ({ value: t, label: t }));

interface CreateOrderModalProps {
  isOpen: boolean;
  customers: Customer[];
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateOrderModal({ isOpen, customers, onClose, onCreated }: Readonly<CreateOrderModalProps>) {
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  const [eventName, setEventName] = useState('');
  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [guestCount, setGuestCount] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const customerFieldRef = useRef<HTMLDivElement>(null);

  const filteredCustomers = useMemo(() => {
    const term = customerQuery.trim().toLowerCase();
    if (!term) return customers.slice(0, 8);
    return customers.filter((c) => c.customerName.toLowerCase().includes(term) || c.phone.includes(term)).slice(0, 8);
  }, [customers, customerQuery]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.customerId === customerId) ?? null,
    [customers, customerId],
  );

  useEffect(() => {
    if (!isCustomerDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (customerFieldRef.current && !customerFieldRef.current.contains(e.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCustomerDropdownOpen]);

  const resetAndClose = () => {
    setCustomerQuery('');
    setCustomerId('');
    setIsCustomerDropdownOpen(false);
    setEventName('');
    setEventType('');
    setEventDate('');
    setEndDate('');
    setLocation('');
    setLatitude(undefined);
    setLongitude(undefined);
    setGuestCount('');
    setErrors({});
    setSubmitError(null);
    onClose();
  };

  const handleSelectCustomer = (customer: Customer) => {
    setCustomerId(customer.customerId);
    setCustomerQuery(customer.customerName);
    setIsCustomerDropdownOpen(false);
  };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!customerId) next.customerId = 'Vui lòng chọn khách hàng';

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: VN_TIME_ZONE });
    if (!eventDate) {
      next.eventDate = 'Vui lòng chọn ngày tổ chức';
    } else if (eventDate <= todayStr) {
      next.eventDate = 'Ngày tổ chức phải sau ngày hôm nay';
    }

    if (!endDate) {
      next.endDate = 'Vui lòng chọn ngày kết thúc';
    } else if (eventDate && endDate < eventDate) {
      next.endDate = 'Ngày kết thúc phải sau ngày tổ chức';
    }

    if (!eventType) next.eventType = 'Vui lòng chọn loại sự kiện';
    if (!location.trim()) next.location = 'Vui lòng nhập địa điểm tổ chức';
    if (guestCount && Number(guestCount) < 1) next.guestCount = 'Số lượng khách phải lớn hơn 0';

    return next;
  };

  const handleSubmit = async () => {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await orderApiService.createOrder({
        customerId,
        ...(eventName.trim() ? { eventName: eventName.trim() } : {}),
        eventType,
        eventDate: new Date(eventDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        location: location.trim(),
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
        ...(guestCount ? { guestCount: Number(guestCount) } : {}),
        items: [],
      });
      resetAndClose();
      onCreated();
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setSubmitError(axiosError.response?.data?.message ?? 'Không thể tạo đơn hàng. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Tạo đơn hàng mới"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={resetAndClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            Tạo đơn hàng
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

          <div ref={customerFieldRef} className="relative">
            <Input
              label="Khách hàng"
              required
              error={errors.customerId}
              value={customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                setCustomerId('');
                setIsCustomerDropdownOpen(true);
              }}
              onFocus={() => setIsCustomerDropdownOpen(true)}
              placeholder="Gõ tên hoặc số điện thoại để tìm"
              autoComplete="off"
            />
            {isCustomerDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                {filteredCustomers.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-500">Không tìm thấy khách hàng</p>
                ) : (
                  <ul className="max-h-56 overflow-y-auto">
                    {filteredCustomers.map((c) => (
                      <li key={c.customerId}>
                        <button
                          type="button"
                          onClick={() => handleSelectCustomer(c)}
                          className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          <span className="font-medium text-gray-900">{c.customerName}</span>
                          <span className="text-xs text-gray-500">{c.phone}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {selectedCustomer && (
            <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 sm:grid-cols-3">
              <span>
                <span className="text-slate-400">SĐT: </span>
                {selectedCustomer.phone}
              </span>
              <span>
                <span className="text-slate-400">Email: </span>
                {selectedCustomer.email || '—'}
              </span>
              <span>
                <span className="text-slate-400">Địa chỉ: </span>
                {selectedCustomer.address || '—'}
              </span>
            </div>
          )}
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
              type="date"
              label="Ngày tổ chức"
              required
              value={eventDate}
              error={errors.eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
            <Input
              type="date"
              label="Ngày kết thúc"
              required
              min={eventDate || undefined}
              value={endDate}
              error={errors.endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
          </div>
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      </div>
    </Modal>
  );
}
