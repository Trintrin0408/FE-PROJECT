'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, DollarSign, Package, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { formatCurrency } from '@/utils/formatCurrency';
import {
  AdminSurveyReport,
  SURVEY_ASSIGNEE_OPTIONS,
  SurveyQuoteItem,
  SurveyRentalItem,
  getSurveyScheduledTargets,
  nextAdminSurveyReportId,
} from '@/mocks/db';

interface SurveyCreateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (report: AdminSurveyReport) => void;
}

const RENTAL_SUGGESTIONS = ['Cổng hoa cưới', 'Bàn gallery', 'Đèn Moving', 'Thảm đỏ', 'Màn LED'];
const QUOTE_SUGGESTIONS: { name: string; price: number }[] = [
  { name: 'Cổng hoa lụa nháp', price: 3_500_000 },
  { name: 'Bàn gallery nháp', price: 1_500_000 },
  { name: 'Màn LED P3 nháp', price: 8_000_000 },
  { name: 'Âm thanh trọn gói nháp', price: 6_000_000 },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultEventDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export default function SurveyCreateDrawer({ isOpen, onClose, onSubmit }: Readonly<SurveyCreateDrawerProps>) {
  // Tính lại mỗi lần render (không phải constant module-scope) để phản ánh đúng kế hoạch khảo sát mới
  // lập qua "Kế hoạch & phân công" ngay trong cùng phiên, không cần tải lại trang mới thấy.
  const surveyTargets = getSurveyScheduledTargets();
  const [orderId, setOrderId] = useState(surveyTargets[0]?.id ?? '');
  const [surveyDate, setSurveyDate] = useState(todayIso());
  const [eventDate, setEventDate] = useState(defaultEventDate());
  const [assignee, setAssignee] = useState(SURVEY_ASSIGNEE_OPTIONS[0]);
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');

  const [measurement1, setMeasurement1] = useState('8m (rộng) x 4m (sâu) x 0.6m (cao)');
  const [measurement2, setMeasurement2] = useState('4.8m đến dầm treo đèn');
  const [measurement3, setMeasurement3] = useState('3-phase 380V / 60A');
  const [measurement4, setMeasurement4] = useState('Thang máy chở hàng số 3 (1.5 tấn)');

  const [rentalItems, setRentalItems] = useState<SurveyRentalItem[]>([
    { name: 'Khung sắt bọc 3m x 6m', quantity: 1, notes: 'Khung truss sân khấu chính' },
  ]);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemQty, setCustomItemQty] = useState(1);
  const [customItemNotes, setCustomItemNotes] = useState('');

  const [quoteItems, setQuoteItems] = useState<SurveyQuoteItem[]>([
    { name: 'Khung sắt bọc 3m x 6m (Báo giá nháp)', quantity: 1, unit: 'Bộ', price: 3_500_000, category: 'Thi công' },
  ]);
  const [customQuoteName, setCustomQuoteName] = useState('');
  const [customQuoteQty, setCustomQuoteQty] = useState(1);
  const [customQuotePrice, setCustomQuotePrice] = useState(500_000);

  const selectedOrder = surveyTargets.find((o) => o.id === orderId) ?? surveyTargets[0];

  const resetForm = () => {
    setOrderId(surveyTargets[0]?.id ?? '');
    setSurveyDate(todayIso());
    setEventDate(defaultEventDate());
    setAssignee(SURVEY_ASSIGNEE_OPTIONS[0]);
    setContent('');
    setNotes('');
    setRentalItems([{ name: 'Khung sắt bọc 3m x 6m', quantity: 1, notes: 'Khung truss sân khấu chính' }]);
    setQuoteItems([{ name: 'Khung sắt bọc 3m x 6m (Báo giá nháp)', quantity: 1, unit: 'Bộ', price: 3_500_000, category: 'Thi công' }]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const addCustomRentalItem = () => {
    if (!customItemName.trim()) return;
    setRentalItems((prev) => [...prev, { name: customItemName.trim(), quantity: customItemQty, notes: customItemNotes.trim() }]);
    setCustomItemName('');
    setCustomItemQty(1);
    setCustomItemNotes('');
  };

  const addCustomQuoteItem = () => {
    if (!customQuoteName.trim()) return;
    setQuoteItems((prev) => [...prev, { name: customQuoteName.trim(), quantity: customQuoteQty, unit: 'Cái', price: customQuotePrice, category: 'Thiết bị' }]);
    setCustomQuoteName('');
    setCustomQuoteQty(1);
    setCustomQuotePrice(500_000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !selectedOrder) return;

    const newReport: AdminSurveyReport = {
      id: nextAdminSurveyReportId(),
      orderId,
      customerName: selectedOrder.customerName,
      eventName: selectedOrder.eventName,
      surveyDate,
      eventDate,
      location: selectedOrder.location,
      assignee,
      submittedTime: `${surveyDate} 09:30`,
      status: 'PENDING_CONFIRM',
      content,
      measurements: [
        { key: 'Diện tích sân khấu chính', value: measurement1 || 'Chưa ghi nhận' },
        { key: 'Chiều cao trần (Clearance)', value: measurement2 || 'Chưa ghi nhận' },
        { key: 'Công suất nguồn điện khả dụng', value: measurement3 || 'Chưa ghi nhận' },
        { key: 'Lối vận chuyển đồ', value: measurement4 || 'Chưa ghi nhận' },
      ],
      notes,
      images: [],
      rentalItems,
      quoteItems,
    };

    onSubmit(newReport);
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={handleClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col justify-between border-l border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Thiết lập dữ liệu nghiệp vụ</span>
            <h3 className="mt-0.5 text-base font-bold text-slate-900">Tạo báo cáo khảo sát hiện trường</h3>
          </div>
          <button type="button" onClick={handleClose} className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-200/50 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-grow space-y-5 overflow-y-auto p-6 text-xs text-slate-700">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h4 className="border-l-2 border-blue-600 pl-2 text-[10px] font-bold uppercase tracking-wider text-slate-900">
              Thông tin đơn đặt &amp; khách hàng
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <SearchableSelect
                label="Mã đơn đặt &amp; báo giá"
                value={orderId}
                onChange={setOrderId}
                searchPlaceholder="Tìm theo mã đơn/báo giá hoặc tên khách hàng..."
                emptyText="Không tìm thấy đơn đặt/báo giá đã có lịch khảo sát."
                options={surveyTargets.map((o) => ({ value: o.id, label: `${o.id} (${o.customerName})` }))}
              />
              <Input label="Ngày thực hiện khảo sát" type="date" value={surveyDate} onChange={(e) => setSurveyDate(e.target.value)} />
            </div>
            {surveyTargets.length === 0 && (
              <p className="text-[11px] italic text-amber-600">
                Chưa có đơn đặt hoặc báo giá nào được lên lịch khảo sát — lập lịch khảo sát ở &quot;Kế hoạch &amp; phân công&quot; trước.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-100 bg-white p-3">
              <div>
                <span className="block text-[10px] font-semibold uppercase text-slate-400">Khách hàng</span>
                <span className="mt-0.5 block font-bold text-slate-800">{selectedOrder?.customerName ?? '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase text-slate-400">Sự kiện</span>
                <span className="mt-0.5 block font-bold text-slate-800">{selectedOrder?.eventName ?? '—'}</span>
              </div>
              <div className="col-span-2">
                <span className="block text-[10px] font-semibold uppercase text-slate-400">Địa điểm khảo sát</span>
                <span className="mt-0.5 block font-semibold text-slate-700">{selectedOrder?.location ?? '—'}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Ngày diễn ra sự kiện" type="date" required value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              <Select
                label="Nhân viên thực hiện khảo sát"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                options={SURVEY_ASSIGNEE_OPTIONS.map((name) => ({ value: name, label: name }))}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h4 className="border-l-2 border-blue-600 pl-2 text-[10px] font-bold uppercase tracking-wider text-slate-900">
              Thông số đo đạc &amp; kỹ thuật
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <Input label="1. Diện tích sân khấu" value={measurement1} onChange={(e) => setMeasurement1(e.target.value)} />
              <Input label="2. Chiều cao thông thủy trần" value={measurement2} onChange={(e) => setMeasurement2(e.target.value)} />
              <Input label="3. Nguồn cấp điện khả dụng" value={measurement3} onChange={(e) => setMeasurement3(e.target.value)} />
              <Input label="4. Lối vận chuyển & thang hàng" value={measurement4} onChange={(e) => setMeasurement4(e.target.value)} />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h4 className="border-l-2 border-blue-600 pl-2 text-[10px] font-bold uppercase tracking-wider text-slate-900">
              Ghi nhận chi tiết từ hiện trường
            </h4>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Nội dung khảo sát tổng quan *</label>
              <textarea
                rows={4}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Mô tả hiện trạng mặt bằng sảnh tiệc, các điều kiện lắp ghép, kết cấu treo thả..."
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-medium leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Lưu ý thi công quan trọng (nếu có)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Các lưu ý đặc biệt từ ban quản lý sảnh tiệc, giờ bốc dỡ hàng, các yêu cầu an toàn bắt buộc..."
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-medium italic text-amber-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="flex flex-col justify-between space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="space-y-4">
                <h4 className="flex items-center gap-1.5 border-l-2 border-blue-600 pl-2 text-[10px] font-bold uppercase tracking-wider text-slate-900">
                  <Package className="h-4 w-4 text-blue-600" />
                  Đồ đạc / thiết bị đề xuất thuê ({rentalItems.length})
                </h4>

                {rentalItems.length > 0 ? (
                  <div className="max-h-[220px] overflow-auto rounded-lg border border-slate-200 bg-white shadow-xs">
                    <table className="w-full min-w-[320px] border-collapse text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500">
                          <th className="px-2.5 py-2">Tên thiết bị</th>
                          <th className="w-16 px-2.5 py-2 text-center">SL</th>
                          <th className="px-2.5 py-2">Ghi chú</th>
                          <th className="w-8 px-1 py-2 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {rentalItems.map((item, index) => (
                          <tr key={`${item.name}-${index}`} className="hover:bg-slate-50/50">
                            <td className="max-w-[120px] truncate px-2.5 py-1.5 font-semibold text-slate-800">{item.name}</td>
                            <td className="px-2 py-1.5">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setRentalItems((prev) => prev.map((it, i) => (i === index ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it)))}
                                  className="flex h-4 w-4 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-600 hover:bg-slate-200"
                                >
                                  -
                                </button>
                                <span className="w-4 text-center text-[10px] font-bold text-slate-900">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => setRentalItems((prev) => prev.map((it, i) => (i === index ? { ...it, quantity: it.quantity + 1 } : it)))}
                                  className="flex h-4 w-4 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-600 hover:bg-slate-200"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                value={item.notes}
                                onChange={(e) => setRentalItems((prev) => prev.map((it, i) => (i === index ? { ...it, notes: e.target.value } : it)))}
                                placeholder="Ghi chú sử dụng..."
                                className="w-full rounded border border-slate-200 bg-slate-50/50 px-1 py-0.5 text-[9px] focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-1 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => setRentalItems((prev) => prev.filter((_, i) => i !== index))}
                                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-center italic text-slate-400">
                    Danh sách trống. Thêm thiết bị bên dưới.
                  </div>
                )}
              </div>

              <div className="mt-2 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                <span className="block text-[9px] font-bold uppercase text-slate-400">Thêm nhanh thiết bị đề xuất thuê:</span>
                <div className="grid grid-cols-12 gap-1.5">
                  <input
                    type="text"
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                    placeholder="Tên thiết bị..."
                    className="col-span-5 rounded-lg border border-slate-200 bg-slate-50 p-1 text-[11px] focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    min={1}
                    value={customItemQty}
                    onChange={(e) => setCustomItemQty(parseInt(e.target.value, 10) || 1)}
                    className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-1 text-center text-[11px] font-bold text-blue-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={customItemNotes}
                    onChange={(e) => setCustomItemNotes(e.target.value)}
                    placeholder="Ghi chú..."
                    className="col-span-3 rounded-lg border border-slate-200 bg-slate-50 p-1 text-[11px] focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={addCustomRentalItem}
                    className="col-span-2 flex items-center justify-center rounded-lg bg-blue-600 text-[10px] font-bold text-white shadow-sm hover:bg-blue-700"
                  >
                    +
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 border-t border-slate-100 pt-1">
                  {RENTAL_SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setRentalItems((prev) => [...prev, { name: item, quantity: 1, notes: 'Khảo sát đề xuất' }])}
                      className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                    >
                      + {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 border-l-2 border-emerald-600 pl-2 text-[10px] font-bold uppercase tracking-wider text-slate-900">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    Thiết bị báo giá nháp ({quoteItems.length})
                  </h4>
                  <span className="text-[10px] font-bold text-emerald-600">
                    Tạm tính: {formatCurrency(quoteItems.reduce((sum, item) => sum + item.price * item.quantity, 0))}
                  </span>
                </div>

                {quoteItems.length > 0 ? (
                  <div className="max-h-[220px] overflow-auto rounded-lg border border-slate-200 bg-white shadow-xs">
                    <table className="w-full min-w-[320px] border-collapse text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500">
                          <th className="px-2.5 py-2">Thiết bị báo giá</th>
                          <th className="w-14 px-1 py-2 text-center">SL</th>
                          <th className="w-24 px-2 py-2 text-right">Đơn giá nháp</th>
                          <th className="w-8 px-1 py-2 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {quoteItems.map((item, index) => (
                          <tr key={`${item.name}-${index}`} className="hover:bg-slate-50/50">
                            <td className="max-w-[120px] truncate px-2.5 py-1.5 font-semibold text-slate-800" title={item.name}>
                              {item.name}
                            </td>
                            <td className="px-1 py-1.5">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setQuoteItems((prev) => prev.map((it, i) => (i === index ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it)))}
                                  className="flex h-4 w-4 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-600 hover:bg-slate-200"
                                >
                                  -
                                </button>
                                <span className="w-4 text-center text-[10px] font-bold text-slate-900">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => setQuoteItems((prev) => prev.map((it, i) => (i === index ? { ...it, quantity: it.quantity + 1 } : it)))}
                                  className="flex h-4 w-4 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-600 hover:bg-slate-200"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <input
                                type="number"
                                step={50000}
                                value={item.price}
                                onChange={(e) =>
                                  setQuoteItems((prev) => prev.map((it, i) => (i === index ? { ...it, price: Math.max(0, parseInt(e.target.value, 10) || 0) } : it)))
                                }
                                className="w-full rounded border border-slate-200 bg-slate-50/50 px-1 py-0.5 text-right text-[10px] font-bold text-emerald-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-1 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => setQuoteItems((prev) => prev.filter((_, i) => i !== index))}
                                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-center italic text-slate-400">
                    Danh sách trống. Thêm thiết bị báo giá nháp bên dưới.
                  </div>
                )}
              </div>

              <div className="mt-2 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                <span className="block text-[9px] font-bold uppercase text-slate-400">Thêm thiết bị báo giá nháp mới:</span>
                <div className="grid grid-cols-12 gap-1.5">
                  <input
                    type="text"
                    value={customQuoteName}
                    onChange={(e) => setCustomQuoteName(e.target.value)}
                    placeholder="Thiết bị báo giá..."
                    className="col-span-5 rounded-lg border border-slate-200 bg-slate-50 p-1 text-[11px] focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    min={1}
                    value={customQuoteQty}
                    onChange={(e) => setCustomQuoteQty(parseInt(e.target.value, 10) || 1)}
                    className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-1 text-center text-[11px] font-bold text-emerald-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    step={50000}
                    value={customQuotePrice}
                    onChange={(e) => setCustomQuotePrice(parseInt(e.target.value, 10) || 0)}
                    className="col-span-3 rounded-lg border border-slate-200 bg-slate-50 p-1 text-right text-[11px] font-semibold text-emerald-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={addCustomQuoteItem}
                    className="col-span-2 flex items-center justify-center rounded-lg bg-emerald-600 text-[10px] font-bold text-white shadow-sm hover:bg-emerald-700"
                  >
                    +
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 border-t border-slate-100 pt-1">
                  {QUOTE_SUGGESTIONS.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => setQuoteItems((prev) => [...prev, { name: s.name, quantity: 1, unit: 'Cái', price: s.price, category: 'Thiết bị' }])}
                      className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      + {s.name} ({formatCurrency(s.price)})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </form>

        <div className="flex justify-end gap-2.5 border-t border-slate-200 bg-slate-50 p-5">
          <Button variant="secondary" onClick={handleClose}>
            Hủy bỏ
          </Button>
          <Button onClick={handleSubmit}>
            <CheckCircle2 className="h-4 w-4" />
            Nộp báo cáo khảo sát
          </Button>
        </div>
      </motion.div>
    </>
  );
}
