'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useDebounce } from '@/hooks/useDebounce';
import { orderApiService } from '@/services/order.service';
import { surveyApiService } from '@/services/survey.service';
import type { Order } from '@/types/order';
import type { CreateSurveyReportPayload } from '@/types/survey';

// Thêm lại theo yêu cầu người dùng (2026-07-21) — trước đó đã chủ động bỏ nút tạo báo cáo khảo sát
// trên web (xem comment ở src/app/manager/survey/page.tsx) vì mặc định coi đây là hành động của
// Leader Staff qua mobile. Người dùng xác nhận vẫn muốn Manager tạo được bản ghi này trên web, nên
// dựng lại form mới bám đúng shape thật (types/survey.ts CreateSurveyReportPayload) — KHÔNG tái dùng
// SurveyCreateDrawer.tsx cũ (đã lỗi thời, dùng mock AdminSurveyReport khác hẳn field thật).
// Chỉ gắn ở trang Manager, không gắn ở trang Admin — Admin không xử lý vận hành hằng ngày (mục 1).
// 2026-07-22: Backend xác nhận endpoint này hiện CHỈ cho role LEADER gọi — gọi từ Manager sẽ nhận 403
// cho tới khi Backend nới lỏng thêm role MANAGER (yêu cầu đã ghi ở docs/more-require.md mục (ai)).
// `orderId` gửi đi PHẢI là order.orderId (UUID thật) — không dùng order.orderCode (mã hiển thị).

interface SurveyReportCreateDrawerProps {
  onClose: () => void;
  onCreated: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SurveyReportCreateDrawer({ onClose, onCreated }: Readonly<SurveyReportCreateDrawerProps>) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderSearchInput, setOrderSearchInput] = useState('');
  const orderSearch = useDebounce(orderSearchInput, 300);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  const [orderId, setOrderId] = useState('');
  const [surveyDate, setSurveyDate] = useState(todayIso());
  const [location, setLocation] = useState('');
  const [area, setArea] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [entrance, setEntrance] = useState('');
  const [siteConstraints, setSiteConstraints] = useState('');
  const [proposedItems, setProposedItems] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingOrders(true);
    orderApiService
      .getOrders({ search: orderSearch.trim() || undefined, limit: 20 })
      .then((res) => {
        if (cancelled) return;
        setOrders(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingOrders(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderSearch]);

  const selectedOrder = orders.find((o) => o.orderId === orderId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !surveyDate || !location.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload: CreateSurveyReportPayload = {
        orderId,
        surveyDate: new Date(surveyDate).toISOString(),
        location: location.trim(),
        area: area ? Number(area) : undefined,
        length: length ? Number(length) : undefined,
        width: width ? Number(width) : undefined,
        entrance: entrance.trim() || undefined,
        siteConstraints: siteConstraints.trim() || undefined,
        proposedItems: proposedItems.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      await surveyApiService.createSurveyReport(payload);
      onCreated();
    } catch {
      setSubmitError('Không tạo được báo cáo khảo sát. Vui lòng kiểm tra lại thông tin và thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col justify-between border-l border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ghi nhận khảo sát hiện trường</span>
            <h3 className="mt-0.5 text-base font-bold text-slate-900">Tạo báo cáo khảo sát</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-200/50 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form id="survey-report-create-form" onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-6 text-xs text-slate-700">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h4 className="border-l-2 border-blue-600 pl-2 text-[10px] font-bold uppercase tracking-wider text-slate-900">
              Đơn đặt &amp; thời gian khảo sát
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <SearchableSelect
                  label="Mã đơn đặt"
                  required
                  value={orderId}
                  onChange={(value) => {
                    setOrderId(value);
                    const order = orders.find((o) => o.orderId === value);
                    if (order && !location) setLocation(order.location);
                  }}
                  searchPlaceholder="Tìm theo mã đơn hoặc tên khách hàng..."
                  emptyText={isLoadingOrders ? 'Đang tải danh sách đơn đặt...' : 'Không tìm thấy đơn đặt phù hợp.'}
                  options={orders.map((o) => ({ value: o.orderId, label: `${o.orderCode} — ${o.customerName}` }))}
                />
                <input
                  type="text"
                  value={orderSearchInput}
                  onChange={(e) => setOrderSearchInput(e.target.value)}
                  placeholder="Gõ để lọc thêm đơn đặt theo mã/tên khách hàng..."
                  className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {selectedOrder && (
                <div className="col-span-2 grid grid-cols-2 gap-3 rounded-lg border border-slate-100 bg-white p-3">
                  <div>
                    <span className="block text-[10px] font-semibold uppercase text-slate-400">Khách hàng</span>
                    <span className="mt-0.5 block font-bold text-slate-800">{selectedOrder.customerName}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold uppercase text-slate-400">Sự kiện</span>
                    <span className="mt-0.5 block font-bold text-slate-800">{selectedOrder.eventName || '—'}</span>
                  </div>
                </div>
              )}
              <Input label="Ngày thực hiện khảo sát" type="date" required value={surveyDate} onChange={(e) => setSurveyDate(e.target.value)} />
              <Input label="Địa điểm khảo sát" required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Địa chỉ tổ chức sự kiện..." />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h4 className="border-l-2 border-blue-600 pl-2 text-[10px] font-bold uppercase tracking-wider text-slate-900">
              Thông số đo đạc
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Diện tích (m²)" type="number" min={0} step="0.1" value={area} onChange={(e) => setArea(e.target.value)} />
              <Input label="Chiều dài (m)" type="number" min={0} step="0.1" value={length} onChange={(e) => setLength(e.target.value)} />
              <Input label="Chiều rộng (m)" type="number" min={0} step="0.1" value={width} onChange={(e) => setWidth(e.target.value)} />
            </div>
            <Input label="Thông tin lối vào" value={entrance} onChange={(e) => setEntrance(e.target.value)} placeholder="VD: Lối chính rộng 3m, có bậc thềm..." />
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h4 className="border-l-2 border-blue-600 pl-2 text-[10px] font-bold uppercase tracking-wider text-slate-900">
              Ghi nhận chi tiết từ hiện trường
            </h4>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Các hạn chế tại địa điểm</label>
              <textarea
                rows={3}
                value={siteConstraints}
                onChange={(e) => setSiteConstraints(e.target.value)}
                placeholder="Mô tả hiện trạng mặt bằng, các điều kiện lắp ghép, kết cấu treo thả..."
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-medium leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Đồ đạc / thiết bị đề xuất thuê</label>
              <textarea
                rows={3}
                value={proposedItems}
                onChange={(e) => setProposedItems(e.target.value)}
                placeholder="Liệt kê thiết bị đề xuất thuê thêm dựa trên khảo sát thực tế..."
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-medium leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Lưu ý thi công quan trọng (nếu có)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Các lưu ý đặc biệt, giờ bốc dỡ hàng, yêu cầu an toàn bắt buộc..."
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-medium italic text-amber-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {submitError && <p className="rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-600">{submitError}</p>}
        </form>

        <div className="flex justify-end gap-2.5 border-t border-slate-150 bg-slate-50 p-5">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy bỏ
          </Button>
          <Button type="submit" form="survey-report-create-form" isLoading={isSubmitting} disabled={!orderId || !location.trim()}>
            <CheckCircle2 className="h-4 w-4" />
            Tạo báo cáo khảo sát
          </Button>
        </div>
      </motion.div>
    </>
  );
}
