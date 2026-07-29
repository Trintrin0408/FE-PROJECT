'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';
import { Plus, Trash2, Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { quotationApiService } from '@/services/quotation.service';
import { catalogApiService } from '@/services/catalog.service';
import { formatCurrency } from '@/utils/formatCurrency';
import { getItemContent } from '@/utils/catalogItemContent';
import type { QuotationDetail } from '@/types/quotation';
import type { Item } from '@/types/catalog';

interface QuotationItemDraft {
  key: string;
  itemId: string;
  quantity: number;
  price: number;
  discount: number;
}

interface CreateQuotationModalProps {
  isOpen: boolean;
  /** Quotation thuộc Customer (không thuộc Order) — luôn cần biết trước customerId khi mở modal. */
  customerId: string;
  /** Truyền vào khi sửa bản nháp hiện có (chỉ hợp lệ khi status === 'DRAFT'). */
  editingQuotation?: QuotationDetail | null;
  onClose: () => void;
  onSuccess: () => void;
}

let draftKeySeq = 0;
function nextDraftKey(): string {
  draftKeySeq += 1;
  return `item-${draftKeySeq}`;
}

export default function CreateQuotationModal({
  isOpen,
  customerId,
  editingQuotation,
  onClose,
  onSuccess,
}: Readonly<CreateQuotationModalProps>) {
  const isEditMode = Boolean(editingQuotation);

  const [itemList, setItemList] = useState<Item[]>([]);
  const [items, setItems] = useState<QuotationItemDraft[]>([]);
  const [notes, setNotes] = useState('');
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<'draft' | 'approve' | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    catalogApiService.getItems({ limit: 200 }).then((res) => setItemList(res.data ?? []));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (editingQuotation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting the item draft list when the modal opens or the edit target changes, not a render loop
      setItems(
        editingQuotation.items.map((item) => ({
          key: nextDraftKey(),
          itemId: item.itemId,
          quantity: item.quantity,
          price: item.price,
          discount: item.discount ?? 0,
        })),
      );
      setNotes(editingQuotation.notes ?? '');
    } else {
      setItems([]);
      setNotes('');
    }
    setItemsError(null);
    setSubmitError(null);
  }, [isOpen, editingQuotation]);

  const itemById = useMemo(() => new Map(itemList.map((i) => [i.itemId, i])), [itemList]);

  const itemOptions = useMemo(
    () => itemList.map((i) => ({ value: i.itemId, label: `${i.itemName} (${formatCurrency(i.rentalPrice)})` })),
    [itemList],
  );

  const resetAndClose = () => {
    setSubmitError(null);
    setItemsError(null);
    onClose();
  };

  const handleAddItem = () => {
    const first = itemList[0];
    setItems((prev) => [
      ...prev,
      { key: nextDraftKey(), itemId: first?.itemId ?? '', quantity: 1, price: first?.rentalPrice ?? 0, discount: 0 },
    ]);
  };

  const handleRemoveItem = (key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  const handleItemChange = (key: string, itemId: string) => {
    const item = itemById.get(itemId);
    setItems((prev) => prev.map((row) => (row.key === key ? { ...row, itemId, price: item?.rentalPrice ?? row.price } : row)));
  };

  const handleQuantityChange = (key: string, quantity: number) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, quantity } : item)));
  };

  const handlePriceChange = (key: string, price: number) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, price } : item)));
  };

  const handleDiscountChange = (key: string, discount: number) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, discount } : item)));
  };

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const discountTotal = items.reduce((sum, item) => sum + item.discount, 0);
  const totalAmount = subtotal - discountTotal;

  const handleSubmit = async (thenApprove: boolean) => {
    if (items.length === 0) {
      setItemsError('Vui lòng thêm ít nhất một hạng mục báo giá.');
      return;
    }
    if (items.some((item) => !item.itemId)) {
      setItemsError('Vui lòng chọn thiết bị/dịch vụ cho tất cả các hạng mục.');
      return;
    }
    if (items.some((item) => item.quantity < 1)) {
      setItemsError('Số lượng phải lớn hơn 0.');
      return;
    }
    setItemsError(null);

    const itemsAndNotes = {
      notes: notes.trim() || undefined,
      items: items.map((item) => ({ itemId: item.itemId, quantity: item.quantity, price: item.price, discount: item.discount })),
    };

    setSubmittingAction(thenApprove ? 'approve' : 'draft');
    setSubmitError(null);
    try {
      let targetId = editingQuotation?.quotationId;
      if (isEditMode && editingQuotation) {
        // Backend bắt buộc gửi kèm `version` ở mọi lần PUT (thiếu sẽ luôn 400 VALIDATION_ERROR) — gửi
        // lại đúng version hiện tại, không đổi version chỉ vì sửa hạng mục (xem types/quotation.ts).
        await quotationApiService.updateQuotation(editingQuotation.quotationId, { ...itemsAndNotes, version: editingQuotation.version });
      } else {
        const res = await quotationApiService.createQuotation(customerId, {
          ...itemsAndNotes,
          version: 'v1.0',
        });
        targetId = res.data?.quotationId;
      }
      if (thenApprove && targetId) {
        await quotationApiService.updateQuotationStatus(targetId, { status: 'approved' });
      }
      onSuccess();
      resetAndClose();
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setSubmitError(
        axiosError.response?.data?.message ??
          (isEditMode ? 'Không thể cập nhật báo giá. Vui lòng thử lại.' : 'Không thể tạo báo giá. Vui lòng thử lại.'),
      );
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title={isEditMode ? `Sửa báo giá nháp — phiên bản ${editingQuotation?.version}` : 'Tạo báo giá mới'}
      subtitle={isEditMode ? undefined : 'Thêm hạng mục báo giá cho khách hàng này'}
      size="2xl"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Hạng mục báo giá</h3>
            <Button type="button" variant="secondary" size="sm" onClick={handleAddItem} disabled={itemList.length === 0}>
              <Plus className="h-4 w-4" />
              Thêm hạng mục
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
              Chưa có hạng mục nào. Nhấn &quot;Thêm hạng mục&quot; để chọn thiết bị/dịch vụ.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, idx) => {
                const catalogItem = itemById.get(item.itemId);
                const lineTotal = item.quantity * item.price - item.discount;
                return (
                  <div key={item.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
                      <div className="sm:col-span-4">
                        <Select
                          label={`Hạng mục #${idx + 1}`}
                          value={item.itemId}
                          placeholder="-- Chọn thiết bị/dịch vụ --"
                          onChange={(e) => handleItemChange(item.key, e.target.value)}
                          options={itemOptions}
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
                          value={item.price}
                          onChange={(e) => handlePriceChange(item.key, Math.max(0, Number(e.target.value) || 0))}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Input
                          type="number"
                          label="Giảm giá (đ)"
                          min={0}
                          value={item.discount}
                          onChange={(e) => handleDiscountChange(item.key, Math.max(0, Number(e.target.value) || 0))}
                        />
                      </div>
                      <div className="sm:col-span-1 text-sm">
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
                    {catalogItem && (
                      <div className="mt-2 space-y-0.5">
                        <p className="text-xs text-slate-400">Đơn vị: {catalogItem.unit}</p>
                        {(() => {
                          const content = getItemContent(catalogItem, catalogItem.itemName);
                          return (
                            <p
                              className={`text-xs ${content.isMock ? 'italic text-slate-400' : 'text-slate-500'}`}
                              title={
                                content.isMock
                                  ? 'Backend chưa có API mô tả chi tiết loại thiết bị (equipment_type_details) — dữ liệu minh họa'
                                  : undefined
                              }
                            >
                              {content.text}
                            </p>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Input label="Ghi chú" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ghi chú cho báo giá (tuỳ chọn)" />

          {itemsError && <p className="text-sm text-red-600">{itemsError}</p>}
        </div>

        <div className="lg:col-span-4">
          <div className="sticky top-0 space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2.5">
              <h3 className="text-base font-extrabold text-slate-900">Tổng hợp báo giá</h3>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase text-blue-600">
                {isEditMode ? 'Cập nhật' : 'Tạo mới'}
              </span>
            </div>

            <div className="space-y-3 text-xs font-semibold">
              <div className="flex justify-between text-slate-500">
                <span>Tạm tính:</span>
                <span className="font-bold text-slate-900">{formatCurrency(subtotal)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Giảm giá:</span>
                  <span className="font-bold text-slate-900">-{formatCurrency(discountTotal)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
                <span className="text-sm font-black text-slate-800">Tổng tiền cuối:</span>
                <span className="text-xl font-black tracking-tight text-blue-600">{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <div className="space-y-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => handleSubmit(false)}
                isLoading={submittingAction === 'draft'}
                disabled={submittingAction === 'approve'}
              >
                Lưu bản nháp (Draft)
              </Button>
              <Button
                type="button"
                className="w-full"
                onClick={() => handleSubmit(true)}
                isLoading={submittingAction === 'approve'}
                disabled={submittingAction === 'draft'}
              >
                <Check className="h-4 w-4" />
                Xác nhận &amp; Duyệt báo giá
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={resetAndClose} disabled={submittingAction !== null}>
                Hủy
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
