'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, Search, Trash2 } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import CustomerFormModal from '@/components/customers/CustomerFormModal';
import Reveal from '@/components/ui/Reveal';
import { formatCurrency } from '@/utils/formatCurrency';
import {
  AdminQuotationLineItem,
  addAdminQuotation,
  getAdminQuotationById,
  nextAdminQuotationCode,
  updateAdminQuotation,
} from '@/mocks/db/quotations';
import { AdminCustomer, addAdminCustomer, getAdminCustomers, nextAdminCustomerId } from '@/mocks/db/customers';
import { MOCK_ITEMS } from '@/mocks/db/catalog';
import type { Item } from '@/types/catalog';

// Trang thuần giao diện — xem giải thích ở đầu src/mocks/adminQuotationsMock.ts. Quy trình 3 bước
// (chọn khách hàng → hạng mục → tổng kết) chỉ dựng theo đúng bố cục/khái niệm trong ảnh mẫu người
// dùng cung cấp, không lưu được vào hệ thống báo giá thật. Xem chi tiết báo giá (chỉ đọc) nằm ở
// trang riêng `src/app/admin/quotations/[id]/page.tsx`, không phải trang này.

const CATALOG_ITEMS = MOCK_ITEMS.filter((item) => item.status === 'ACTIVE');
const COMPANY_NAME = 'CÔNG TY SỰ KIỆN BN';

const STEPS = [
  { step: 1, label: 'Chọn khách hàng' },
  { step: 2, label: 'Danh sách hạng mục' },
  { step: 3, label: 'Tổng kết & Lưu' },
] as const;

interface DraftLineItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discount: string;
}

function emptyDraftItem(): DraftLineItem {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    category: '',
    unit: 'Cái',
    quantity: '1',
    unitPrice: '',
    discount: '0',
  };
}

function draftItemFromCatalog(catalogItem: Item): DraftLineItem {
  return {
    id: `row-${Date.now()}-${catalogItem.itemId}`,
    name: catalogItem.itemName,
    category: catalogItem.typeName ?? '',
    unit: catalogItem.unit,
    quantity: '1',
    unitPrice: String(catalogItem.rentalPrice),
    discount: '0',
  };
}

function draftItemFromExisting(item: AdminQuotationLineItem): DraftLineItem {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit ?? 'Cái',
    quantity: String(item.quantity),
    unitPrice: String(item.unitPrice),
    discount: String(item.discount ?? 0),
  };
}

const cellInputClassName =
  'w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

function ItemNameSearchInput({
  value,
  onChange,
  onPick,
}: Readonly<{ value: string; onChange: (v: string) => void; onPick: (item: Item) => void }>) {
  const [isOpen, setIsOpen] = useState(false);
  const suggestions = useMemo(() => {
    const term = value.trim().toLowerCase();
    if (!term) return [];
    return CATALOG_ITEMS.filter((it) => it.itemName.toLowerCase().includes(term)).slice(0, 6);
  }, [value]);

  return (
    <div className="relative min-w-[180px]">
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="Tìm trong kho hoặc nhập tên..."
        className={`${cellInputClassName} pl-7`}
      />
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-64 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {suggestions.map((it) => (
            <li key={it.itemId}>
              <button
                type="button"
                onMouseDown={() => onPick(it)}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-blue-50"
              >
                <span className="truncate">{it.itemName}</span>
                <span className="flex-shrink-0 text-xs text-slate-400">{formatCurrency(it.rentalPrice)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuotationFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  const existing = useMemo(() => (editId ? getAdminQuotationById(editId) : undefined), [editId]);
  const isEditMode = Boolean(existing);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [customers, setCustomers] = useState<AdminCustomer[]>(() => getAdminCustomers());
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => existing?.customerId ?? '');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const selectedCustomer = customers.find((c) => c.customerId === selectedCustomerId) ?? null;

  const [items, setItems] = useState<DraftLineItem[]>(() => existing?.items.map(draftItemFromExisting) ?? []);

  const handleAddCustomer = (values: Omit<AdminCustomer, 'customerId' | 'totalBookings' | 'totalSpent'>) => {
    const newCustomer: AdminCustomer = { customerId: nextAdminCustomerId(), totalBookings: 0, totalSpent: 0, ...values };
    addAdminCustomer(newCustomer);
    setCustomers((prev) => [newCustomer, ...prev]);
    setSelectedCustomerId(newCustomer.customerId);
    setIsAddCustomerOpen(false);
  };

  const addCatalogItem = (catalogItem: Item) => setItems((prev) => [...prev, draftItemFromCatalog(catalogItem)]);
  const addManualItem = () => setItems((prev) => [...prev, emptyDraftItem()]);
  const updateItem = (id: string, patch: Partial<DraftLineItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));
  const pickCatalogForRow = (id: string, catalogItem: Item) =>
    updateItem(id, {
      name: catalogItem.itemName,
      category: catalogItem.typeName ?? '',
      unit: catalogItem.unit,
      unitPrice: String(catalogItem.rentalPrice),
    });

  const subtotal = items.reduce((sum, it) => sum + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0), 0);
  const totalDiscount = items.reduce((sum, it) => sum + (Number(it.discount) || 0) * (Number(it.quantity) || 0), 0);
  const grandTotal = subtotal - totalDiscount;

  const handleSave = () => {
    if (!selectedCustomer) return;
    const cleanItems: AdminQuotationLineItem[] = items
      .filter((it) => it.name.trim())
      .map((it) => ({
        id: it.id,
        name: it.name.trim(),
        category: it.category.trim() || 'Khác',
        unit: it.unit.trim() || 'Cái',
        unitPrice: Number(it.unitPrice) || 0,
        quantity: Number(it.quantity) || 1,
        discount: Number(it.discount) || 0,
      }));
    const finalSubtotal = cleanItems.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
    const finalDiscount = cleanItems.reduce((sum, it) => sum + (it.discount ?? 0) * it.quantity, 0);

    const payload = {
      servicePackage: existing?.servicePackage ?? `Báo giá dịch vụ sự kiện - ${selectedCustomer.customerName}`,
      customerId: selectedCustomer.customerId,
      customerName: selectedCustomer.customerName,
      customerPhone: selectedCustomer.phone,
      guestCount: existing?.guestCount ?? 0,
      tablePrice: 0,
      items: cleanItems,
      subtotal: finalSubtotal,
      discount: finalDiscount,
      totalAmount: finalSubtotal - finalDiscount,
      version: existing?.version ?? 1,
      notes: existing?.notes,
      status: existing?.status ?? ('draft' as const),
    };

    if (existing) {
      updateAdminQuotation(existing.quotationId, { ...payload, updatedAt: new Date().toISOString().slice(0, 10) });
      router.push(`/admin/quotations/${existing.quotationId}`);
      return;
    }

    const today = new Date();
    const quotationId = `bg-${Date.now()}`;
    addAdminQuotation({
      quotationId,
      code: nextAdminQuotationCode(),
      assignee: 'Lê Minh Dũng',
      createdAt: today.toISOString().slice(0, 10),
      updatedAt: today.toISOString().slice(0, 10),
      validUntil: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      ...payload,
    });
    router.push('/admin/quotations');
  };

  return (
    <div className="p-6">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => router.push(existing ? `/admin/quotations/${existing.quotationId}` : '/admin/quotations')}
          aria-label="Quay lại"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isEditMode ? 'Chỉnh sửa báo giá' : 'Tạo báo giá mới'}</h1>
          <p className="mt-1 text-sm text-slate-500">Quy trình soạn thảo báo giá kinh doanh theo từng bước rõ ràng.</p>
        </div>
      </div>

      <Reveal className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex w-max items-center gap-2">
          {STEPS.map((s, index) => (
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
              {index < STEPS.length - 1 && <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />}
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.05} className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        {step === 1 && (
          <div>
            <h2 className="text-base font-bold text-slate-900">Bước 1: Chọn khách hàng lập báo giá</h2>
            <p className="mt-1 text-sm text-slate-500">Báo giá bắt buộc phải gắn liền với một khách hàng có trên hệ thống.</p>

            <div className="mt-5 max-w-2xl">
              <Select
                label="Lựa chọn khách hàng có sẵn"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                options={[
                  { value: '', label: '-- Chọn khách hàng --' },
                  ...customers.map((c) => ({ value: c.customerId, label: `${c.customerName} (${c.customerId} - ${c.phone})` })),
                ]}
              />

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Hoặc</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <Button variant="secondary" className="w-full" onClick={() => setIsAddCustomerOpen(true)}>
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
            <p className="mt-1 text-sm text-slate-500">Thêm trang thiết bị loa, đài, đèn sân khấu, màn LED hoặc nhân sự MC, ca sĩ.</p>

            <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <p className="text-xs font-semibold text-slate-500">Chọn nhanh từ danh mục kho thiết bị có sẵn:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CATALOG_ITEMS.map((catalogItem) => (
                  <button
                    key={catalogItem.itemId}
                    type="button"
                    onClick={() => addCatalogItem(catalogItem)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {catalogItem.itemName} ({formatCurrency(catalogItem.rentalPrice)})
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Tên hạng mục *</th>
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
                        Chưa có hạng mục nào - chọn nhanh từ kho hoặc thêm dòng nhập tay.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const lineTotal = ((Number(item.unitPrice) || 0) - (Number(item.discount) || 0)) * (Number(item.quantity) || 0);
                      return (
                        <tr key={item.id}>
                          <td className="px-3 py-2 align-top">
                            <ItemNameSearchInput
                              value={item.name}
                              onChange={(v) => updateItem(item.id, { name: v })}
                              onPick={(catalogItem) => pickCatalogForRow(item.id, catalogItem)}
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <input
                              value={item.category}
                              onChange={(e) => updateItem(item.id, { category: e.target.value })}
                              className={`${cellInputClassName} w-32`}
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <input value={item.unit} onChange={(e) => updateItem(item.id, { unit: e.target.value })} className={`${cellInputClassName} w-16`} />
                          </td>
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

            <Button variant="secondary" className="mt-3" onClick={addManualItem}>
              <Plus className="h-4 w-4" />
              Thêm dòng nhập tay
            </Button>

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
              <Button variant="secondary" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4" />
                Quay lại
              </Button>
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Đơn vị lập</p>
                  <p className="mt-0.5 font-bold text-slate-900">{COMPANY_NAME}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Đối tượng khách hàng</p>
                  <p className="mt-0.5 font-bold text-slate-900">{selectedCustomer.customerName}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 sm:grid-cols-3">
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

            <div className="mt-6 flex justify-between border-t border-slate-100 pt-5">
              <Button variant="secondary" onClick={() => setStep(2)}>
                <ChevronLeft className="h-4 w-4" />
                Quay lại
              </Button>
              <Button onClick={handleSave}>Lưu</Button>
            </div>
          </div>
        )}
      </Reveal>

      <CustomerFormModal isOpen={isAddCustomerOpen} onClose={() => setIsAddCustomerOpen(false)} onSubmit={handleAddCustomer} />
    </div>
  );
}

export default function AdminQuotationFormPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">Đang tải...</div>}>
      <QuotationFormContent />
    </Suspense>
  );
}
