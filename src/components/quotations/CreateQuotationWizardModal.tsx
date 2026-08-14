'use client';

import { useEffect, useState } from 'react';
import type { AxiosError } from 'axios';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Button } from '@/components/ui/Button';
import CustomerFormModal, { CustomerFormValues } from '@/components/customers/CustomerFormModal';
import QuotationCatalogPicker from '@/components/quotations/QuotationCatalogPicker';
import { formatCurrency } from '@/utils/formatCurrency';
import { customerApiService } from '@/services/customer.service';
import { inventoryApiService } from '@/services/inventory.service';
import { quotationApiService } from '@/services/quotation.service';
import type { Customer } from '@/types/customer';
import type { InventoryRow } from '@/types/inventory';

// Nối API thật theo docs/taobaogiamoi_api.md — mọi quyết định kiến trúc ở mục 3 đã CHỐT, áp dụng
// nguyên văn ở đây: (3.1) bỏ hẳn "Thêm dòng nhập tay" — mọi hạng mục bắt buộc có itemId thật (FK NOT
// NULL trên quotation_items); (3.2) bỏ 5 field servicePackage/guestCount/tablePrice/assignee/validUntil
// (không có cột thật); (3.4) discount gửi lên là TỔNG của cả dòng (đơn giá giảm/item × số lượng);
// (3.5) version luôn gửi cứng "v1" từ modal này.
//
// Cập nhật 2026-07-21 (xác nhận qua curl thật): `GET /inventory` giờ trả kèm `rentalPrice` thật (join
// items.rental_price) — không còn phải fix cứng đơn giá gợi ý như trước, dùng thẳng
// `catalogItem.rentalPrice` khi chọn hạng mục.

const STEPS = [
  { step: 1, label: 'Chọn khách hàng' },
  { step: 2, label: 'Danh sách hạng mục' },
  { step: 3, label: 'Tổng kết & Lưu' },
] as const;

interface DraftLineItem {
  id: string;
  /** FK bắt buộc tới items.item_id thật — không còn dòng "nhập tay" nào thiếu field này (Hướng A). */
  itemId: string;
  name: string;
  category: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discount: string;
}

function draftItemFromCatalog(catalogItem: InventoryRow): DraftLineItem {
  return {
    id: `row-${Date.now()}-${catalogItem.itemId}`,
    itemId: catalogItem.itemId,
    name: catalogItem.itemName ?? catalogItem.itemCode ?? catalogItem.itemId,
    category: catalogItem.typeName ?? 'Khác',
    unit: catalogItem.unit ?? 'Cái',
    quantity: '1',
    unitPrice: String(catalogItem.rentalPrice ?? 0),
    discount: '0',
  };
}

const cellInputClassName =
  'w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

interface CreateQuotationWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (createdQuotationId?: string) => void;
  /** Khi truyền vào: khóa cứng khách hàng, bỏ hẳn Bước 1 (dùng khi mở wizard này từ 1 khách hàng đã
   * xác định sẵn, vd modal Tạo đơn hàng — không cần chọn lại khách). */
  presetCustomer?: Customer;
  /** Khi bật: sau khi lưu, tự PATCH status=approved luôn thay vì để lại bản nháp — dùng cho luồng Tạo
   * đơn hàng, nơi Manager cần báo giá ở trạng thái duyệt được ngay để liên kết vào đơn mới tạo. */
  autoApprove?: boolean;
}

export default function CreateQuotationWizardModal({
  isOpen,
  onClose,
  onSaved,
  presetCustomer,
  autoApprove,
}: Readonly<CreateQuotationWizardModalProps>) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [catalogItems, setCatalogItems] = useState<InventoryRow[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [addCustomerError, setAddCustomerError] = useState<string | null>(null);
  const selectedCustomer = customers.find((c) => c.customerId === selectedCustomerId) ?? null;
  // Preset khách hàng (mở từ modal Tạo đơn hàng) — Bước 1 vô nghĩa vì khách đã chốt sẵn, ẩn khỏi
  // breadcrumb luôn thay vì chỉ nhảy qua, tránh gây hiểu lầm còn có bước chọn khách phía sau.
  const visibleSteps = presetCustomer ? STEPS.filter((s) => s.step !== 1) : STEPS;
  const [items, setItems] = useState<DraftLineItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Tải khách hàng + catalog thật (từ /inventory, xem giải thích ở đầu file) 1 lần khi mở modal —
  // SearchableSelect chỉ lọc client-side trên mảng đã tải, không hỗ trợ tìm kiếm bất đồng bộ (doc mục 4
  // gợi ý đổi component, chưa làm ở lần nối API này vì là component dùng chung).
  // Khi có `presetCustomer` (mở từ modal Tạo đơn hàng): bỏ qua GET /customers, khóa cứng khách hàng đã
  // chọn sẵn và nhảy thẳng vào Bước 2 — Bước 1 không còn ý nghĩa gì trong luồng này.
  useEffect(() => {
    if (!isOpen) return;
    if (presetCustomer) {
      setCustomers([presetCustomer]);
      setSelectedCustomerId(presetCustomer.customerId);
      setStep(2);
    } else {
      setStep(1);
      setSelectedCustomerId('');
      setIsLoadingCustomers(true);
      // limit tối đa backend thật chấp nhận cho /customers là 100 (400 VALIDATION_ERROR nếu vượt quá,
      // khác /inventory ở dưới không giới hạn 200 — xem docs/more-require.md).
      customerApiService
        .getCustomers({ limit: 100 })
        .then((res) => setCustomers(res.data ?? []))
        .catch(() => setCustomers([]))
        .finally(() => setIsLoadingCustomers(false));
    }
    setItems([]);
    setSaveError(null);
    setIsLoadingCatalog(true);
    inventoryApiService
      .getInventory({ limit: 200 })
      .then((res) => setCatalogItems(res.data ?? []))
      .catch(() => setCatalogItems([]))
      .finally(() => setIsLoadingCatalog(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, presetCustomer?.customerId]);

  const resetState = () => {
    setStep(1);
    setSelectedCustomerId('');
    setItems([]);
    setSaveError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleAddCustomer = async (values: CustomerFormValues) => {
    setIsCreatingCustomer(true);
    setAddCustomerError(null);
    try {
      const res = await customerApiService.createCustomer(values);
      const created = res.data;
      setCustomers((prev) => [created, ...prev]);
      setSelectedCustomerId(created.customerId);
      setIsAddCustomerOpen(false);
    } catch (err) {
      // Trước đây bỏ qua hoàn toàn (comment cũ giả định CustomerFormModal tự hiển thị lỗi — SAI, modal
      // đó không có cơ chế này) — lỗi thật (vd trùng số điện thoại, 409) rơi vào im lặng, người dùng
      // không biết vì sao bấm "Lưu hồ sơ" không có phản ứng gì. Đã thêm prop `submitError` cho
      // CustomerFormModal để hiển thị đúng lỗi backend trả về.
      const axiosError = err as AxiosError<{ message?: string; error?: { message?: string } }>;
      setAddCustomerError(axiosError.response?.data?.error?.message ?? axiosError.response?.data?.message ?? 'Không thể tạo khách hàng mới. Vui lòng thử lại.');
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  // Chọn trùng 1 hạng mục đã có trong bảng (cùng itemId) thì chỉ cộng dồn số lượng thay vì thêm dòng mới.
  const addCatalogItem = (catalogItem: InventoryRow) =>
    setItems((prev) => {
      const existing = prev.find((it) => it.itemId === catalogItem.itemId);
      if (existing) {
        return prev.map((it) =>
          it.id === existing.id ? { ...it, quantity: String((Number(it.quantity) || 0) + 1) } : it,
        );
      }
      return [...prev, draftItemFromCatalog(catalogItem)];
    });
  const updateItem = (id: string, patch: Partial<DraftLineItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));

  const subtotal = items.reduce((sum, it) => sum + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0), 0);
  const totalDiscount = items.reduce((sum, it) => sum + (Number(it.discount) || 0) * (Number(it.quantity) || 0), 0);
  const grandTotal = subtotal - totalDiscount;

  const handleSave = async () => {
    if (!selectedCustomer) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await quotationApiService.createQuotation(selectedCustomer.customerId, {
        version: 'v1',
        items: items.map((it) => ({
          itemId: it.itemId,
          quantity: Number(it.quantity) || 1,
          price: Number(it.unitPrice) || 0,
          discount: (Number(it.discount) || 0) * (Number(it.quantity) || 1),
        })),
      });
      const createdQuotationId: string | undefined = res.data?.quotationId;
      if (autoApprove && createdQuotationId) {
        // Không chặn thành công của bước tạo nếu riêng bước duyệt lỗi — báo giá vẫn được tạo (draft),
        // chỉ là chưa tự duyệt được, Manager có thể vào trang báo giá duyệt tay sau.
        await quotationApiService.updateQuotationStatus(createdQuotationId, { status: 'approved' }).catch(() => {});
      }
      resetState();
      onSaved(createdQuotationId);
    } catch {
      setSaveError('Lưu báo giá thất bại. Vui lòng kiểm tra lại hạng mục và thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Tạo báo giá mới" subtitle="Quy trình tạo báo giá." size="2xl">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex w-max items-center gap-2">
          {visibleSteps.map((s, index) => (
            <div key={s.step} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    step === s.step ? 'bg-blue-600 text-white' : step > s.step ? 'bg-blue-100 text-blue-600' : 'border border-slate-200 text-slate-400'
                  }`}
                >
                  {s.step}
                </span>
                <span className={`whitespace-nowrap text-sm font-medium ${step >= s.step ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</span>
              </div>
              {index < visibleSteps.length - 1 && <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {step === 1 && (
          <div>
            <h2 className="text-base font-bold text-slate-900">Bước 1: Chọn khách hàng lập báo giá</h2>
            <p className="mt-1 text-sm text-slate-500">Báo giá bắt buộc phải gắn liền với một khách hàng có trên hệ thống.</p>

            <div className="mt-5">
              <SearchableSelect
                label="Lựa chọn khách hàng có sẵn"
                value={selectedCustomerId}
                onChange={setSelectedCustomerId}
                placeholder={isLoadingCustomers ? 'Đang tải danh sách khách hàng...' : '-- Chọn khách hàng --'}
                searchPlaceholder="Tìm theo tên, mã khách hàng hoặc số điện thoại..."
                emptyText="Không tìm thấy khách hàng phù hợp."
                disabled={isLoadingCustomers}
                options={customers.map((c) => ({ value: c.customerId, label: `${c.customerName} (${c.customerId.slice(0, 8)} - ${c.phone})` }))}
              />

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Hoặc</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setAddCustomerError(null);
                  setIsAddCustomerOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Thêm nhanh khách hàng mới
              </Button>

              {selectedCustomer && (
                <div className="mt-5 rounded-lg bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">Khách hàng được chọn:</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                    <p className="text-slate-600">
                      Tên: <span className="font-semibold text-slate-900">{selectedCustomer.customerName}</span>
                    </p>
                    <p className="text-slate-600">
                      SĐT: <span className="font-semibold text-slate-900">{selectedCustomer.phone}</span>
                    </p>
                    <p className="text-slate-600">
                      Hòm thư: <span className="font-semibold text-slate-900">{selectedCustomer.email || '—'}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
              <Button disabled={!selectedCustomer} onClick={() => setStep(2)}>
                Tiếp tục
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-base font-bold text-slate-900">Bước 2: Chi tiết các hạng mục thiết bị/dịch vụ</h2>
            {/* <p className="mt-1 text-sm text-slate-500">Chọn thiết bị/dịch vụ có thật trong kho — báo giá bắt buộc gắn với hạng mục có sẵn.</p> */}
            {/* <p className="mt-1 text-xs text-slate-400">
              Đơn giá tự điền theo đơn giá thuê niêm yết trong kho — có thể sửa tay trước khi lưu (báo giá là ảnh chụp giá tại thời điểm lập).
            </p> */}

            <div className="mt-5">
              <QuotationCatalogPicker catalogItems={catalogItems} isLoading={isLoadingCatalog} onPick={addCatalogItem} />
            </div>

            <div className="mt-5 overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Tên hạng mục</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Phân loại</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">ĐVT</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">SL</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Đơn giá (đ)</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Giảm giá/item</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Thành tiền</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                        Chưa có hạng mục nào — chọn nhanh từ kho ở trên.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const lineTotal = ((Number(item.unitPrice) || 0) - (Number(item.discount) || 0)) * (Number(item.quantity) || 0);
                      return (
                        <tr key={item.id}>
                          <td className="px-3 py-2 align-top">
                            <p className="px-1 py-1.5 text-sm font-medium text-slate-800">{item.name}</p>
                          </td>
                          <td className="px-3 py-2 align-top text-slate-600">{item.category}</td>
                          <td className="px-3 py-2 align-top text-slate-600">{item.unit}</td>
                          <td className="px-3 py-2 align-top">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
                              className={`${cellInputClassName} w-16 text-right`}
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => updateItem(item.id, { unitPrice: e.target.value })}
                              className={`${cellInputClassName} w-28 text-right`}
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <input
                              type="number"
                              value={item.discount}
                              onChange={(e) => updateItem(item.id, { discount: e.target.value })}
                              className={`${cellInputClassName} w-24 text-right text-red-600`}
                            />
                          </td>
                          <td className="px-3 py-2 text-right align-top font-semibold text-slate-900">{formatCurrency(lineTotal)}</td>
                          <td className="px-3 py-2 text-right align-top">
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              aria-label="Xóa hạng mục"
                              className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <div className="w-full max-w-xs space-y-1.5 text-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Tạm tính:</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Giảm giá:</span>
                  <span className="font-semibold text-red-500">-{formatCurrency(totalDiscount)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 text-base">
                  <span className="font-semibold text-slate-800">Thực tế:</span>
                  <span className="font-bold text-blue-600">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between border-t border-slate-100 pt-5">
              {presetCustomer ? (
                <span />
              ) : (
                <Button variant="secondary" onClick={() => setStep(1)}>
                  <ChevronLeft className="h-4 w-4" />
                  Quay lại
                </Button>
              )}
              <Button disabled={items.length === 0} onClick={() => setStep(3)}>
                Tiếp tục
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && selectedCustomer && (
          <div>
            <h2 className="text-base font-bold text-slate-900">Bước 3: Tổng quan & Lưu hoàn tất báo giá</h2>
            <p className="mt-1 text-sm text-slate-500">Kiểm tra thông số kỹ thuật, khách hàng liên đới và lưu trữ văn bản chính thức.</p>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/60 p-5">
              <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-400">Họ tên khách:</p>
                  <p className="font-semibold text-slate-800">{selectedCustomer.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Số điện thoại:</p>
                  <p className="font-semibold text-slate-800">{selectedCustomer.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Địa chỉ liên lạc:</p>
                  <p className="font-semibold text-slate-800">{selectedCustomer.address || '—'}</p>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Thống kê tài chính</p>
                <div className="mt-2 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3">
                  <div className="text-center">
                    <p className="text-xs text-slate-400">Tổng dịch vụ:</p>
                    <p className="mt-0.5 font-bold text-slate-900">{formatCurrency(subtotal)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400">Khấu trừ giảm giá:</p>
                    <p className="mt-0.5 font-bold text-red-500">-{formatCurrency(totalDiscount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400">Tổng cộng thanh toán:</p>
                    <p className="mt-0.5 font-bold text-blue-600">{formatCurrency(grandTotal)}</p>
                  </div>
                </div>
              </div>
            </div>

            {saveError && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">{saveError}</p>}

            <div className="mt-6 flex justify-between border-t border-slate-100 pt-5">
              <Button variant="secondary" onClick={() => setStep(2)} disabled={isSaving}>
                <ChevronLeft className="h-4 w-4" />
                Quay lại
              </Button>
              <Button onClick={handleSave} isLoading={isSaving}>
                Lưu
              </Button>
            </div>
          </div>
        )}
      </div>

      <CustomerFormModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onSubmit={handleAddCustomer}
        isSubmitting={isCreatingCustomer}
        submitError={addCustomerError}
      />
    </Modal>
  );
}
