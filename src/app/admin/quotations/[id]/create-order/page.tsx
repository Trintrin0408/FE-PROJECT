'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatCurrency } from '@/utils/formatCurrency';
import { ITEM_CATEGORY_OPTIONS, getAdminQuotationById } from '@/mocks/db/quotations';
import { AdminOrderLineItem, COORDINATOR_POOL, PACKAGE_OPTIONS, VENUE_OPTIONS, getAdminOrders } from '@/mocks/db/orders';

// Trang thuần giao diện — xem giải thích ở đầu adminOrdersMock.ts/adminQuotationsMock.ts. Port wizard
// 5 bước "Tạo đơn đặt sự kiện" từ docs/components/Orders.tsx (viewMode='create'), rút gọn Bước 1-2
// thành xem lại (không phải bộ chọn) vì lối vào duy nhất của trang này là từ 1 báo giá ĐÃ DUYỆT cụ
// thể — không có nhu cầu chọn lại khách hàng/báo giá khác giữa chừng. Theo yêu cầu người dùng, màn
// này CHỈ DỰNG GIAO DIỆN — bước 5 không gọi addAdminOrder/tạo Order thật, chỉ điều hướng lại danh
// sách báo giá để minh hoạ luồng thao tác.

const STEPS = [
  { step: 1, label: 'Khách hàng' },
  { step: 2, label: 'Báo giá liên quan' },
  { step: 3, label: 'Thông tin sự kiện' },
  { step: 4, label: 'Hạng mục thiết bị' },
  { step: 5, label: 'Lưu hoàn tất' },
];

function emptyItem(): AdminOrderLineItem {
  return {
    id: `oi-new-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    category: ITEM_CATEGORY_OPTIONS[3],
    description: '',
    quantity: 1,
    unitPrice: 0,
    status: 'pending',
    source: 'internal',
    preparedQty: 0,
    preparedBy: '',
  };
}

export default function CreateOrderFromQuotationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const quotation = getAdminQuotationById(params.id);
  const existingOrder = quotation ? getAdminOrders().find((o) => o.quotationId === quotation.quotationId) : undefined;

  // Bỏ qua bước chọn khách hàng/báo giá (đã biết sẵn) — vào thẳng Bước 3 như hành vi "prefilled" của
  // bản mẫu gốc, nhưng vẫn giữ đủ 5 bước để xem lại/điều hướng qua lại.
  const [currentStep, setCurrentStep] = useState(3);
  const [eventName, setEventName] = useState(() => (quotation ? `Sự kiện chốt từ báo giá ${quotation.code}` : ''));
  const [eventDate, setEventDate] = useState('');
  const [venue, setVenue] = useState(VENUE_OPTIONS[0]);
  const [packageType, setPackageType] = useState(PACKAGE_OPTIONS[0]);
  const [coordinatorName, setCoordinatorName] = useState(() => quotation?.assignee ?? COORDINATOR_POOL[0]);
  const [guestCount, setGuestCount] = useState(() => quotation?.guestCount ?? 100);
  const [notes, setNotes] = useState(() => quotation?.notes ?? '');
  const [items, setItems] = useState<AdminOrderLineItem[]>(() =>
    quotation
      ? quotation.items.map((qi, idx) => ({
          id: `oi-from-${quotation.quotationId}-${idx}`,
          category: qi.category,
          description: qi.name,
          quantity: qi.quantity,
          unitPrice: Math.max(0, qi.unitPrice - (qi.discount ?? 0)),
          status: 'pending' as const,
          source: 'internal' as const,
          preparedQty: 0,
          preparedBy: '',
        }))
      : [],
  );

  if (!quotation) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">Không tìm thấy báo giá.</p>
        <Link href="/admin/quotations" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  if (quotation.status !== 'approved') {
    return (
      <div className="p-6">
        <p className="text-sm text-amber-600">Báo giá {quotation.code} chưa được duyệt — chỉ có thể sinh đơn đặt từ báo giá đã duyệt.</p>
        <Link href={`/admin/quotations/${quotation.quotationId}`} className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
          Quay lại chi tiết báo giá
        </Link>
      </div>
    );
  }

  if (existingOrder) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-600">
          Báo giá {quotation.code} đã được liên kết với đơn đặt <strong>{existingOrder.orderId}</strong>.
        </p>
        <Link href={`/admin/orders_audit/${existingOrder.orderId}`} className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
          Xem chi tiết đơn đặt
        </Link>
      </div>
    );
  }

  const total = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
  const canContinueStep3 = Boolean(eventName.trim() && eventDate);

  const updateItem = <K extends keyof AdminOrderLineItem>(idx: number, field: K, value: AdminOrderLineItem[K]) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };
  const addManualItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = () => {
    router.push('/admin/quotations');
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-1.5 text-sm text-slate-400">
        <span>Báo giá</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/admin/quotations/${quotation.quotationId}`} className="hover:text-blue-600 hover:underline">
          {quotation.code}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-600">Tạo đơn đặt sự kiện</span>
      </div>

      <div className="mt-2">
        <h1 className="text-2xl font-bold text-slate-900">Tạo đơn đặt sự kiện</h1>
        <p className="mt-1 text-sm text-slate-500">Soạn lập đơn hàng chính thức từ báo giá {quotation.code} đã duyệt.</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25 }}
        className="mx-auto mt-6 flex max-w-3xl items-center justify-around rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        {STEPS.map((item) => (
          <div key={item.step} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                currentStep >= item.step ? 'bg-blue-600 text-white shadow' : 'border border-slate-200 bg-slate-100 text-slate-400'
              }`}
            >
              {item.step}
            </div>
            <span className={`hidden text-xs font-semibold md:inline ${currentStep >= item.step ? 'text-slate-900' : 'text-slate-400'}`}>
              {item.label}
            </span>
            {item.step < 5 && <ArrowRight className="ml-2 hidden h-4 w-4 text-slate-300 md:inline" />}
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="mx-auto mt-4 max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        {currentStep === 1 && (
          <div className="space-y-5 p-6">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-950">Bước 1: Khách hàng chịu trách nhiệm đơn</h4>
              <p className="text-xs text-slate-500">Lấy sẵn từ báo giá {quotation.code} — mọi tài chính, thanh toán cọc sẽ gán vào khách hàng này.</p>
            </div>
            <div className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50 p-4 text-xs">
              <p className="font-bold text-blue-900">Chi tiết khách hàng:</p>
              <p>
                <span className="text-slate-400">Tên:</span> <strong className="text-slate-900">{quotation.customerName}</strong>
              </p>
              <p>
                <span className="text-slate-400">Số điện thoại:</span> {quotation.customerPhone}
              </p>
            </div>
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button onClick={() => setCurrentStep(2)}>
                Tiếp tục
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-5 p-6">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-950">Bước 2: Báo giá liên quan</h4>
              <p className="text-xs text-slate-500">Đơn đặt này được sinh từ báo giá đã duyệt dưới đây.</p>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded border border-blue-600 bg-blue-600 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                  <strong className="font-bold text-slate-900">{quotation.code}</strong>
                  <span className="text-[10px] text-slate-400">v{quotation.version}</span>
                </div>
                <p className="max-w-md truncate text-slate-500">{quotation.notes || 'Không có ghi chú.'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-extrabold text-slate-900">{formatCurrency(quotation.totalAmount)}</p>
                <p className="text-[10px] text-slate-400">{quotation.items.length} hạng mục</p>
              </div>
            </div>
            <p className="text-[11px] italic text-slate-400">Mỗi đơn đặt hiện chỉ liên kết được với 1 báo giá.</p>
            <div className="flex justify-between border-t border-slate-100 pt-4">
              <Button variant="secondary" onClick={() => setCurrentStep(1)}>
                <ArrowLeft className="h-4 w-4" />
                Quay lại
              </Button>
              <Button onClick={() => setCurrentStep(3)}>
                Tiếp tục
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-5 p-6">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-950">Bước 3: Khai báo thông tin sự kiện tổ chức</h4>
              <p className="text-xs text-slate-500">Lịch diễn ra, sảnh tổ chức, và dung lượng khách.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Tên sự kiện / Chương trình" required value={eventName} onChange={(e) => setEventName(e.target.value)} />
              <Input label="Ngày tổ chức sự kiện" type="date" required value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label="Sảnh tổ chức" required value={venue} onChange={(e) => setVenue(e.target.value)} options={VENUE_OPTIONS.map((v) => ({ value: v, label: v }))} />
              <Input label="Số lượng khách mời" type="number" min={10} value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value) || 0)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Gói dịch vụ"
                value={packageType}
                onChange={(e) => setPackageType(e.target.value)}
                options={PACKAGE_OPTIONS.map((p) => ({ value: p, label: p }))}
              />
              <Select
                label="Điều phối viên phụ trách"
                value={coordinatorName}
                onChange={(e) => setCoordinatorName(e.target.value)}
                options={COORDINATOR_POOL.map((c) => ({ value: c, label: c }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="event-notes" className="text-sm font-medium text-gray-700">
                Mô tả cụ thể / Lưu ý vận chuyển
              </label>
              <textarea
                id="event-notes"
                rows={3}
                placeholder="Kích thước cửa ra vào, giờ thi công, lưu ý nguồn điện của khách sạn..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="block w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-4">
              <Button variant="secondary" onClick={() => setCurrentStep(2)}>
                <ArrowLeft className="h-4 w-4" />
                Quay lại
              </Button>
              <Button disabled={!canContinueStep3} onClick={() => setCurrentStep(4)}>
                Tiếp tục
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-5 p-6">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-950">Bước 4: Danh sách trang thiết bị sự kiện điều phối</h4>
              <p className="text-xs text-slate-500">Lấy sẵn từ hạng mục báo giá {quotation.code} — chỉnh sửa nguồn kho, đơn giá chốt nếu cần.</p>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 text-xs">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead className="border-b border-slate-100 bg-slate-50 font-semibold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5">Tên thiết bị / Hạng mục</th>
                    <th className="w-16 px-3 py-2.5 text-center">SL</th>
                    <th className="w-28 px-3 py-2.5 text-right">Đơn giá (đ)</th>
                    <th className="w-24 px-3 py-2.5 text-center">Nguồn kho</th>
                    <th className="px-3 py-2.5 text-right">Thành tiền</th>
                    <th className="w-10 px-3 py-2.5 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center italic text-slate-400">
                        Chưa có hạng mục nào. Bấm thêm hạng mục bên dưới để cấu hình.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            placeholder="Màn hình LED P3..."
                            value={item.description}
                            onChange={(e) => updateItem(idx, 'description', e.target.value)}
                            className="w-full rounded border bg-slate-50 px-2 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value) || 1)}
                            className="w-full rounded border bg-slate-50 px-1 py-1 text-center font-bold focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            value={item.unitPrice}
                            onChange={(e) => updateItem(idx, 'unitPrice', Number(e.target.value) || 0)}
                            className="w-full rounded border bg-slate-50 px-2 py-1 text-right font-medium focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={item.source}
                            onChange={(e) => updateItem(idx, 'source', e.target.value as AdminOrderLineItem['source'])}
                            className="w-full rounded border bg-slate-50 py-1 text-center font-semibold text-slate-700 focus:outline-none"
                          >
                            <option value="internal">Kho nhà</option>
                            <option value="external">Thuê ngoài</option>
                          </select>
                        </td>
                        <td className="px-2 py-2 pr-3 text-right font-bold text-slate-900">{formatCurrency(item.quantity * item.unitPrice)}</td>
                        <td className="px-2 py-2 text-center">
                          <button type="button" onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={addManualItem} className="flex items-center gap-1 rounded bg-slate-100 px-3 py-1.5 font-bold text-slate-800 transition hover:bg-slate-200">
                <Plus className="h-3.5 w-3.5" />
                Thêm dòng nhập tay
              </button>
              <p>
                Tổng trị giá chốt: <strong className="text-sm text-blue-700">{formatCurrency(total)}</strong>
              </p>
            </div>

            <div className="flex justify-between border-t border-slate-100 pt-4">
              <Button variant="secondary" onClick={() => setCurrentStep(3)}>
                <ArrowLeft className="h-4 w-4" />
                Quay lại
              </Button>
              <Button disabled={items.length === 0} onClick={() => setCurrentStep(5)}>
                Tiếp tục
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-5 p-6">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-950">Bước 5: Xác nhận & Đưa đơn vào vận hành</h4>
              <p className="text-xs text-slate-500">Kiểm tra thông số tổng trước khi lưu đơn đặt.</p>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-5 text-xs">
              <div className="grid grid-cols-1 gap-4 border-b border-slate-200 pb-3 sm:grid-cols-2">
                <p>
                  <span className="block text-[10px] font-bold uppercase text-slate-400">Chủ đơn khách hàng</span>
                  <strong className="text-sm text-slate-900">{quotation.customerName}</strong>
                </p>
                <p>
                  <span className="block text-[10px] font-bold uppercase text-slate-400">Tên sự kiện</span>
                  <strong className="text-sm text-slate-900">{eventName}</strong>
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 border-b border-slate-200 pb-3 sm:grid-cols-3">
                <p>
                  <span className="text-slate-400">Ngày diễn ra:</span> <strong className="text-slate-900">{eventDate}</strong>
                </p>
                <p>
                  <span className="text-slate-400">Số lượng khách:</span> <strong className="text-slate-900">{guestCount} khách</strong>
                </p>
                <p>
                  <span className="text-slate-400">Sảnh tổ chức:</span> <strong className="text-slate-900">{venue}</strong>
                </p>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                <span>Trị giá chốt sau cùng:</span>
                <span className="text-base text-blue-700">{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="flex justify-between border-t border-slate-100 pt-4">
              <Button variant="secondary" onClick={() => setCurrentStep(4)}>
                <ArrowLeft className="h-4 w-4" />
                Quay lại
              </Button>
              <Button onClick={handleSave}>
                <Check className="h-4 w-4" />
                Lưu đơn đặt & liên kết báo giá
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
