'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';
import { Check, Package, Plus, Trash2, User } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatCurrency } from '@/utils/formatCurrency';
import { orderApiService } from '@/services/order.service';
import { catalogApiService } from '@/services/catalog.service';
import { EVENT_TYPES } from '@/constants/order-event-type';
import { VN_TIME_ZONE } from '@/utils/formatDate';
import type { QuotationDetailApi } from '@/types/quotation';
import type { Item } from '@/types/catalog';

// Viết lại 2026-07-21 để nối API thật — bản cũ nhận prop `AdminQuotationRow` (shape mock) và gọi thẳng
// `addAdminOrder()` mock, không tương thích `QuotationDetailApi` thật đã nối ở trang chi tiết báo giá
// (xem docs/more-require.md mục (q)/(s)). Bản mới dùng đúng `CreateOrderPayload` thật
// (customerId/eventType/eventDate ISO/location/guestCount/items[]) — cùng shape đã xác nhận hoạt động ở
// `CreateOrderModal.tsx` — chỉ khác là khách hàng + hạng mục được PREFILL sẵn từ báo giá đã duyệt, và
// gửi kèm `quotationId` để backend tự liên kết Order ↔ Quotation ngay lúc tạo (không cần gọi thêm
// `PATCH /orders/:id/quotation` sau đó). Đã bỏ toàn bộ field không có cột thật trên `orders`
// (weddingEndDate/depositAmount/paymentStatus/coordinatorName/packageType/venue — xem more-require.md
// mục (s) "Field đã bỏ khỏi form so với mock cũ").

interface OrderItemDraft {
  key: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
}

let draftKeySeq = 0;
function nextDraftKey(): string {
  draftKeySeq += 1;
  return `qo-item-${draftKeySeq}`;
}

const EVENT_TYPE_OPTIONS = EVENT_TYPES.map((t) => ({ value: t, label: t }));

interface CreateOrderFromQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: QuotationDetailApi;
  onCreated: (orderId: string) => void;
}

export default function CreateOrderFromQuotationModal({ isOpen, onClose, quotation, onCreated }: Readonly<CreateOrderFromQuotationModalProps>) {
  const [eventName, setEventName] = useState('');
  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [notes, setNotes] = useState('');

  const [itemList, setItemList] = useState<Item[]>([]);
  const [items, setItems] = useState<OrderItemDraft[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prefill lại từ báo giá mỗi khi mở modal — khách hàng + hạng mục lấy sẵn từ quotation.items, GỘP
  // theo itemId (cộng tổng số lượng) trước khi đổ vào bảng — 1 báo giá có thể có nhiều dòng cùng 1
  // itemId (vd đàm phán giá khác nhau cho từng đợt), nhưng đơn hàng chỉ nên có đúng 1 dòng/item với số
  // lượng đã cộng dồn. unitPrice = tổng lineTotal/tổng quantity (giá bình quân sau chiết khấu đã chốt ở
  // báo giá, không phải giá niêm yết `price` gốc).
  useEffect(() => {
    if (!isOpen) return;
    setEventName(`Sự kiện từ báo giá ${quotation.quotationCode}`);
    setEventType('');
    setEventDate('');
    setEndDate('');
    setLocation('');
    setGuestCount('');
    setNotes(quotation.notes ?? '');
    const grouped = new Map<string, { quantity: number; lineTotal: number }>();
    quotation.items.forEach((qi) => {
      const acc = grouped.get(qi.itemId) ?? { quantity: 0, lineTotal: 0 };
      acc.quantity += qi.quantity;
      acc.lineTotal += qi.lineTotal;
      grouped.set(qi.itemId, acc);
    });
    setItems(
      Array.from(grouped.entries()).map(([itemId, acc]) => ({
        key: nextDraftKey(),
        itemId,
        quantity: acc.quantity,
        unitPrice: acc.quantity > 0 ? Math.round(acc.lineTotal / acc.quantity) : 0,
      })),
    );
    setErrors({});
    setSubmitError(null);
    catalogApiService
      .getItems({ limit: 200, status: 'ACTIVE' })
      .then((res) => setItemList(res.data ?? []))
      .catch(() => setItemList([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, quotation.quotationId]);

  const itemById = useMemo(() => new Map(itemList.map((i) => [i.itemId, i])), [itemList]);
  const quotationItemById = useMemo(() => new Map(quotation.items.map((qi) => [qi.itemId, qi])), [quotation.items]);
  const itemOptions = useMemo(
    () => itemList.map((i) => ({ value: i.itemId, label: `${i.itemName} (${formatCurrency(i.rentalPrice)})` })),
    [itemList],
  );

  const nameForItemId = (itemId: string) => itemById.get(itemId)?.itemName ?? quotationItemById.get(itemId)?.itemName ?? itemId;

  const resetAndClose = () => {
    onClose();
  };

  const handleAddItem = () => {
    const first = itemList[0];
    setItems((prev) => [...prev, { key: nextDraftKey(), itemId: first?.itemId ?? '', quantity: 1, unitPrice: first?.rentalPrice ?? 0 }]);
  };

  const handleRemoveItem = (key: string) => setItems((prev) => prev.filter((item) => item.key !== key));

  const handleItemChange = (key: string, itemId: string) => {
    const item = itemById.get(itemId);
    setItems((prev) => prev.map((row) => (row.key === key ? { ...row, itemId, unitPrice: item?.rentalPrice ?? row.unitPrice } : row)));
  };

  const handleQuantityChange = (key: string, quantity: number) =>
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, quantity } : item)));

  const handleUnitPriceChange = (key: string, unitPrice: number) =>
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, unitPrice } : item)));

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
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
    if (items.length === 0) next.items = 'Vui lòng thêm ít nhất một hạng mục thiết bị/dịch vụ';
    if (items.some((item) => !item.itemId)) next.items = 'Vui lòng chọn thiết bị/dịch vụ cho tất cả các hạng mục';
    return next;
  };

  const handleSubmit = async () => {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await orderApiService.createOrder({
        customerId: quotation.customerId,
        quotationId: quotation.quotationId,
        eventName: eventName.trim() || undefined,
        eventType,
        eventDate: new Date(eventDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        location: location.trim(),
        ...(guestCount ? { guestCount: Number(guestCount) } : {}),
        items: items.map((item) => ({ itemId: item.itemId, quantity: item.quantity, unitPrice: item.unitPrice })),
        notes: notes.trim() || undefined,
      });
      onCreated(res.data.orderId);
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setSubmitError(axiosError.response?.data?.message ?? 'Không thể tạo đơn đặt từ báo giá này. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Sinh đơn đặt từ báo giá"
      subtitle={`Tạo đơn đặt chính thức từ báo giá ${quotation.quotationCode} đã duyệt — đơn mới sẽ tự liên kết lại với báo giá này.`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={resetAndClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            <Check className="h-4 w-4" />
            Tạo đơn đặt
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">Khách hàng (lấy từ báo giá)</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 sm:grid-cols-3">
            <span>
              <span className="text-slate-400">Tên: </span>
              <span className="font-medium text-slate-900">{quotation.customerName}</span>
            </span>
            <span>
              <span className="text-slate-400">SĐT: </span>
              {quotation.customerPhone}
            </span>
            <span>
              <span className="text-slate-400">Giá trị báo giá: </span>
              <span className="font-medium text-slate-900">{formatCurrency(quotation.totalAmount)}</span>
            </span>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <div className="mb-3 flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">Thông tin đơn hàng</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Tên sự kiện" value={eventName} onChange={(e) => setEventName(e.target.value)} />
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
              <Input
                label="Địa điểm tổ chức"
                required
                placeholder="VD: 123 Đường ABC, Quận 1, TP.HCM"
                value={location}
                error={errors.location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Hạng mục thiết bị/dịch vụ</h3>
            <Button type="button" variant="secondary" size="sm" onClick={handleAddItem} disabled={itemList.length === 0}>
              <Plus className="h-4 w-4" />
              Thêm hạng mục
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
              Chưa có hạng mục nào. Đơn hàng cần ít nhất 1 hạng mục thiết bị/dịch vụ.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, idx) => {
                const lineTotal = item.quantity * item.unitPrice;
                return (
                  <div key={item.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
                      <div className="sm:col-span-5">
                        <Select
                          label={`Hạng mục #${idx + 1}`}
                          value={item.itemId}
                          placeholder="-- Chọn thiết bị/dịch vụ --"
                          onChange={(e) => handleItemChange(item.key, e.target.value)}
                          options={
                            itemOptions.some((o) => o.value === item.itemId) || !item.itemId
                              ? itemOptions
                              : [{ value: item.itemId, label: `${nameForItemId(item.itemId)} (từ báo giá)` }, ...itemOptions]
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Input
                          type="number"
                          label="Số lượng"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.key, Math.max(1, Number(e.target.value) || 1))}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Input
                          type="number"
                          label="Đơn giá (đ)"
                          min={0}
                          value={item.unitPrice}
                          onChange={(e) => handleUnitPriceChange(item.key, Math.max(0, Number(e.target.value) || 0))}
                        />
                      </div>
                      <div className="sm:col-span-2 text-sm">
                        <span className="mb-1 block text-xs font-medium text-slate-500">Thành tiền</span>
                        <span className="font-bold text-slate-900">{formatCurrency(lineTotal)}</span>
                      </div>
                      <div className="flex justify-end sm:col-span-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.key)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Xóa hạng mục"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-end text-sm font-bold text-slate-900">Tổng tiền: {formatCurrency(totalAmount)}</div>
            </div>
          )}
          {errors.items && <p className="mt-2 text-sm text-red-600">{errors.items}</p>}
        </div>

        <div className="border-t border-slate-100 pt-5">
          <label htmlFor="qo-notes" className="text-sm font-medium text-gray-700">
            Ghi chú
          </label>
          <textarea
            id="qo-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Lưu ý vận chuyển, giờ thi công..."
            className="mt-1 block w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      </div>
    </Modal>
  );
}
