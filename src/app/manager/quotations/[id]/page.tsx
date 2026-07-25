'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check, CheckCircle2, ChevronRight, Copy, FileSignature, Mail, MapPin, Pencil, Phone, Printer, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import { quotationApiService } from '@/services/quotation.service';
import type { QuotationDetailApi, QuotationDetailItem } from '@/types/quotation';
import { getAdminContracts } from '@/mocks/adminContractsMock';
import CreateOrderFromQuotationModal from '@/components/quotations/CreateOrderFromQuotationModal';
import { policyApiService } from '@/services/policy.service';
import type { BusinessPolicy } from '@/types/policy';

// Nối API thật theo docs/xemchitietbaogia_api.md — GET /quotations/:id thật đã trả sẵn ĐÚNG shape mở
// rộng mà doc mục 5.1 đề xuất (customerEmail/customerAddress JOIN, createdBy object, linkedOrderId,
// items[].categoryName/unit JOIN thật) — không cần chờ Backend làm thêm cho phần này.
//
// Đã áp dụng Hướng A đã chốt ở doc mục 2 (nhất quán với docs/danhsachbaogia_api.md mục 3.1): BỎ HẲN
// khối "Phân công khảo sát báo giá" và toàn bộ luồng "Đối chiếu khảo sát" (trạng thái 'surveying' không
// tồn tại trong DB thật) — thay bằng 1 link nhỏ sang đơn đặt liên kết khi có `linkedOrderId`.
// Đã áp dụng Hướng B ở doc mục 3.1/3.2/3.3 cho Trang 2 (Picklist): bỏ hẳn phần bóc tách "vật tư cấu
// thành" (BOM, hard-code theo từ khóa tên — không có bảng nào trong DB thật biểu diễn quan hệ này) và
// bỏ cột/khối tồn kho giả (`getMockInStock` — không có bảng tồn kho thật) — Trang 2 giờ chỉ hiện thẳng
// danh sách quotation_items thật, không bịa thêm tầng dữ liệu nào. Đã xóa 3 component chỉ tồn tại để
// hiển thị dữ liệu bịa này (QuotationPicklistView, InventoryAvailabilityPanel, SurveyComparisonPanel)
// và 2 hàm sinh dữ liệu tương ứng trong db/quotations.ts vì không còn nơi nào dùng.
//
// Sửa hạng mục inline: giữ lại (đổi/xóa số lượng, đơn giá, giảm giá của hạng mục ĐÃ có trong báo giá,
// gọi PUT /quotations/:id thật) nhưng đã bỏ 2 cách "thêm dòng mới" cũ (nhập tay tự do + chọn nhanh từ
// QUOTATION_CATALOGUE) vì cả 2 đều tạo dòng KHÔNG có itemId thật — vi phạm NOT NULL FK trên
// quotation_items, cùng vấn đề đã chốt Hướng A ở docs/taobaogiamoi_api.md mục 3.1. Thêm hạng mục mới
// cho báo giá đã tồn tại tạm thời ngoài phạm vi (cần màn hình chọn catalog giống modal Tạo báo giá mới).
//
// Cập nhật 2026-07-21: "Sinh đơn đặt từ báo giá" đã nối lại API thật — CreateOrderFromQuotationModal
// viết lại nhận đúng QuotationDetailApi + gọi orderApiService.createOrder() thật (xem
// docs/more-require.md mục (q) cập nhật), không còn tạm khóa như trước.

function statusToBadgeVariant(status: QuotationDetailApi['status']): 'success' | 'warning' | 'error' {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'error';
  return 'warning';
}

const STATUS_LABEL: Record<QuotationDetailApi['status'], string> = {
  draft: 'Bản nháp',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

const ROLE_LABEL: Record<string, string> = {
  MANAGER: 'Quản lý',
  ADMIN: 'Quản trị viên',
  LEADER: 'Leader Staff',
  TECHNICAL: 'Technical Staff',
};

interface EditableLineItem extends QuotationDetailItem {
  quantityInput: string;
  priceInput: string;
  discountInput: string;
}

export default function ManagerQuotationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [detail, setDetail] = useState<QuotationDetailApi | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const [detailPage, setDetailPage] = useState<1 | 2>(1);
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editItems, setEditItems] = useState<EditableLineItem[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [generalPolicies, setGeneralPolicies] = useState<BusinessPolicy[]>([]);
  const quotationCardRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setIsLoading(true);
    setLoadError(null);
    quotationApiService
      .getQuotation(id)
      .then((res) => setDetail(res.data ?? null))
      .catch(() => setLoadError('Không tải được báo giá. Vui lòng thử lại.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // "Chính sách chung" đọc từ policyApiService (DEPOSIT/CANCELLATION đang áp dụng ở /admin/policies)
  // thay vì import thẳng MOCK_POLICIES — xem docs/admin_chinhsach_api.md mục 6.2.
  useEffect(() => {
    policyApiService.getPolicies({ isActive: true }).then((res) => {
      setGeneralPolicies(res.data.filter((p: BusinessPolicy) => p.policyType === 'DEPOSIT' || p.policyType === 'CANCELLATION'));
    });
  }, []);

  const isLinkedToContract = detail ? getAdminContracts().some((c) => c.quotationId === detail.quotationId) : false;

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-400">Đang tải báo giá...</p>
      </div>
    );
  }

  if (loadError || !detail) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-500">{loadError ?? 'Không tìm thấy báo giá.'}</p>
        <Link href="/manager/quotations" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const canDelete = detail.status !== 'approved';
  const canApproveReject = detail.status === 'draft';
  const canCreateOrder = detail.status === 'approved' && !detail.linkedOrderId;

  const handleApprove = async () => {
    if (!canApproveReject || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      await quotationApiService.updateQuotationStatus(detail.quotationId, { status: 'approved' });
      load();
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleReject = async () => {
    if (!canApproveReject || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      await quotationApiService.updateQuotationStatus(detail.quotationId, { status: 'rejected' });
      load();
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await quotationApiService.deleteQuotation(detail.quotationId);
      router.push('/manager/quotations');
    } catch {
      setIsDeleting(false);
      setIsDeleteOpen(false);
    }
  };

  const handleCopyImage = async () => {
    if (!quotationCardRef.current || copyState === 'copying') return;
    setCopyState('copying');
    try {
      const { toBlob } = await import('html-to-image');
      const blob = await toBlob(quotationCardRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      if (!blob) throw new Error('Không tạo được ảnh báo giá');

      if (typeof window !== 'undefined' && 'ClipboardItem' in window && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `bao-gia-${detail.quotationCode}.png`;
        link.click();
        URL.revokeObjectURL(url);
      }
      setCopyState('copied');
    } catch (error) {
      console.error('Sao chép ảnh báo giá thất bại:', error);
      setCopyState('error');
    } finally {
      setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  // ---- Sửa hạng mục inline — chỉ sửa số lượng/đơn giá/giảm giá hoặc xóa dòng có sẵn, không thêm dòng
  // mới (mọi hạng mục bắt buộc gắn itemId thật, xem giải thích đầu file) ----
  const startEditingItems = () => {
    setEditItems(
      detail.items.map((it) => ({
        ...it,
        quantityInput: String(it.quantity),
        priceInput: String(it.price),
        discountInput: String(it.discount),
      })),
    );
    setEditNotes(detail.notes ?? '');
    setDetailPage(1);
    setSaveError(null);
    setIsEditingItems(true);
  };

  const updateEditItem = (quotationItemId: string, patch: Partial<EditableLineItem>) =>
    setEditItems((prev) => prev.map((it) => (it.quotationItemId === quotationItemId ? { ...it, ...patch } : it)));
  const removeEditItem = (quotationItemId: string) => setEditItems((prev) => prev.filter((it) => it.quotationItemId !== quotationItemId));

  const editSubtotal = editItems.reduce((sum, it) => sum + (Number(it.priceInput) || 0) * (Number(it.quantityInput) || 0), 0);
  const editDiscountTotal = editItems.reduce((sum, it) => sum + (Number(it.discountInput) || 0), 0);
  const editTotalAmount = editSubtotal - editDiscountTotal;

  const handleSaveEditedItems = async () => {
    if (editItems.length === 0) {
      setSaveError('Báo giá phải có ít nhất 1 hạng mục.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await quotationApiService.updateQuotation(detail.quotationId, {
        notes: editNotes,
        items: editItems.map((it) => ({
          itemId: it.itemId,
          quantity: Number(it.quantityInput) || 1,
          price: Number(it.priceInput) || 0,
          discount: Number(it.discountInput) || 0,
        })),
      });
      setIsEditingItems(false);
      load();
    } catch {
      setSaveError('Lưu thay đổi thất bại. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 print:p-0">
      <div className="flex items-center gap-1.5 text-sm text-slate-400 print:hidden">
        <span>Báo giá</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/manager/quotations" className="hover:text-blue-600 hover:underline">
          Danh sách báo giá
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-600">{detail.quotationCode}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Báo giá {detail.quotationCode}</h1>
            <Badge variant={statusToBadgeVariant(detail.status)}>{STATUS_LABEL[detail.status]}</Badge>
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Phiên bản: {detail.version} | Tạo bởi: {detail.createdBy.fullName} ({ROLE_LABEL[detail.createdBy.role] ?? detail.createdBy.role})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {isEditingItems ? (
            <>
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleSaveEditedItems} isLoading={isSaving}>
                <Check className="h-4 w-4" />
                Lưu thay đổi
              </Button>
              <Button variant="secondary" onClick={() => setIsEditingItems(false)} disabled={isSaving}>
                <X className="h-4 w-4" />
                Hủy bỏ
              </Button>
            </>
          ) : (
            <>
              {detail.linkedOrderId && (
                <Link href={`/manager/orders/${detail.linkedOrderId}`}>
                  <Button variant="secondary">
                    <FileSignature className="h-4 w-4" />
                    Xem đơn đặt liên kết
                  </Button>
                </Link>
              )}
              {canCreateOrder && (
                <Button onClick={() => setIsCreateOrderOpen(true)}>
                  <FileSignature className="h-4 w-4" />
                  Sinh đơn đặt từ báo giá
                </Button>
              )}
              {detailPage === 1 && (
                <>
                  <Button variant="secondary" onClick={handleCopyImage} isLoading={copyState === 'copying'}>
                    {copyState === 'copied' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    {copyState === 'copied' ? 'Đã sao chép!' : copyState === 'error' ? 'Sao chép lỗi' : 'Sao chép ảnh'}
                  </Button>
                  <Button variant="secondary" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" />
                    In báo giá
                  </Button>
                </>
              )}
              {canDelete && (
                <Button variant="secondary" onClick={() => setIsDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4" />
                  Xóa
                </Button>
              )}
              {canApproveReject && (
                <>
                  <Button className="bg-green-600 hover:bg-green-700" onClick={handleApprove} isLoading={isUpdatingStatus}>
                    <CheckCircle2 className="h-4 w-4" />
                    Phê duyệt báo giá
                  </Button>
                  <Button variant="secondary" className="border-red-100 bg-red-50 text-red-600 hover:bg-red-100" onClick={handleReject} disabled={isUpdatingStatus}>
                    <X className="h-4 w-4" />
                    Từ chối
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-6">
        {!isEditingItems && detailPage === 2 ? (
          <div className="mx-auto max-w-4xl overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-900">Danh sách hạng mục cần chuẩn bị</p>
            <p className="mt-1 text-xs italic text-slate-400">
              Chưa có API tồn kho/bóc tách vật tư theo hạng mục — Trang này chỉ hiện đúng danh sách hạng mục đã báo giá, không có cột tồn kho.
            </p>
            <table className="mt-3 w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-3 py-2.5">Tên hạng mục</th>
                  <th className="px-3 py-2.5">Phân loại</th>
                  <th className="px-3 py-2.5 text-center">ĐVT</th>
                  <th className="px-3 py-2.5 text-center">SL cần chuẩn bị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.items.map((item) => (
                  <tr key={item.quotationItemId}>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">{item.itemName}</td>
                    <td className="px-3 py-2.5 text-slate-600">{item.categoryName}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">{item.unit}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-slate-800">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <motion.div
            ref={quotationCardRef}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.25 }}
            className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            {/* Letterhead */}
            <div className="flex flex-wrap justify-between gap-6 border-b border-slate-100 pb-6">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900">
                    <span className="font-mono text-sm font-black text-white">BN</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900">Công ty Sự kiện BN</h4>
                    <p className="text-xs text-slate-500">Giải pháp tổ chức sự kiện đỉnh cao tại Việt Nam</p>
                  </div>
                </div>
                <div className="mt-4 space-y-1 text-xs text-slate-500">
                  <p>VP: 120 Điện Biên Phủ, Phường Đa Kao, Quận 1, TP. HCM</p>
                  <p>Điện thoại: 0944 556 677 | Hòm thư: sales@bnevent.vn</p>
                </div>
              </div>

              <div className="text-right">
                <h3 className="text-lg font-bold uppercase tracking-widest text-slate-900">Báo giá chính thức</h3>
                <p className="mt-1 font-mono text-xs font-bold text-slate-500">Số: {detail.quotationCode}</p>
                <div className="mt-4 space-y-1 text-xs text-slate-500">
                  <p>Ngày lập: {formatDate(detail.createdAt)}</p>
                  <p>Cập nhật cuối: {formatDate(detail.updatedAt)}</p>
                </div>
              </div>
            </div>

            {/* Customer + terms */}
            <div className="mt-6 grid grid-cols-1 gap-8 rounded-xl border border-slate-100 bg-slate-50 p-5 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Đơn vị thụ hưởng (Khách hàng)</p>
                <div className="space-y-1.5 text-xs">
                  <p className="text-sm font-bold text-slate-900">{detail.customerName}</p>
                  <p className="flex items-center gap-1.5 text-slate-600">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> {detail.customerPhone}
                  </p>
                  <p className="flex items-center gap-1.5 text-slate-600">
                    <Mail className="h-3.5 w-3.5 text-slate-400" /> {detail.customerEmail || '—'}
                  </p>
                  <p className="flex items-center gap-1.5 text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" /> {detail.customerAddress || '—'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Ghi chú điều khoản</p>
                  {isEditingItems ? (
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Ghi chú điều khoản hoặc mốc thanh toán..."
                      className="h-20 w-full rounded border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-xs italic leading-relaxed text-slate-700">{detail.notes || 'Không có yêu cầu ghi chú gì thêm cho báo giá này.'}</p>
                  )}
                </div>
                <div className="space-y-1 text-xs text-slate-500">
                  <p className="font-semibold text-slate-700">Chính sách chung:</p>
                  <p className="italic">
                    • (Dữ liệu fix cứng — chưa có API chính sách thật) Báo giá có hiệu lực 30 ngày kể từ ngày lập.
                  </p>
                  {generalPolicies.map((policy) => (
                    <p key={policy.policyId} className="italic">
                      • {policy.policyName}: <strong className="font-semibold text-slate-700">{policy.policyValue.toLocaleString('vi-VN')}{policy.unit}</strong>
                      {policy.description ? ` — ${policy.description}` : ''}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {/* Items table / editor */}
            {isEditingItems ? (
              <div className="mt-6 space-y-4">
                {saveError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">{saveError}</p>}
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50 font-bold uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="px-3 py-2.5">Tên hạng mục</th>
                        <th className="w-28 px-3 py-2.5">Phân loại</th>
                        <th className="w-16 px-3 py-2.5 text-center">SL</th>
                        <th className="w-28 px-3 py-2.5 text-right">Đơn giá (đ)</th>
                        <th className="w-28 px-3 py-2.5 text-right">Giảm giá (tổng dòng)</th>
                        <th className="w-28 px-3 py-2.5 text-right">Thành tiền</th>
                        <th className="w-10 px-3 py-2.5 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center italic text-slate-400">
                            Chưa có hạng mục nào.
                          </td>
                        </tr>
                      ) : (
                        editItems.map((item) => {
                          const lineTotal = (Number(item.priceInput) || 0) * (Number(item.quantityInput) || 0) - (Number(item.discountInput) || 0);
                          return (
                            <tr key={item.quotationItemId} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2 font-medium text-slate-800">{item.itemName}</td>
                              <td className="px-3 py-2 text-slate-600">{item.categoryName}</td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={item.quantityInput}
                                  onChange={(e) => updateEditItem(item.quotationItemId, { quantityInput: e.target.value })}
                                  className="w-full rounded border border-slate-200 bg-slate-50 px-1 py-1 text-center text-xs font-bold focus:outline-none"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.priceInput}
                                  onChange={(e) => updateEditItem(item.quotationItemId, { priceInput: e.target.value })}
                                  className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-right text-xs font-medium focus:outline-none"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.discountInput}
                                  onChange={(e) => updateEditItem(item.quotationItemId, { discountInput: e.target.value })}
                                  className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-right text-xs font-medium text-red-600 focus:outline-none"
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(lineTotal)}</td>
                              <td className="px-2 py-2 text-center">
                                <button type="button" onClick={() => removeEditItem(item.quotationItemId)} className="p-1 text-slate-400 transition hover:text-red-600">
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
                <p className="text-xs italic text-slate-400">
                  Chưa hỗ trợ thêm hạng mục mới ở đây — mọi hạng mục bắt buộc gắn thiết bị thật trong kho, cần màn chọn catalog giống modal "Tạo báo giá mới".
                </p>
              </div>
            ) : (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-900">Hạng mục báo giá</p>
                  {!isLinkedToContract && detail.status === 'draft' && (
                    <button type="button" onClick={startEditingItems} aria-label="Sửa hạng mục" className="text-slate-400 hover:text-blue-600">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="w-12 py-3 px-4 text-center">STT</th>
                        <th className="py-3 px-4">Tên hạng mục sự kiện / Dịch vụ</th>
                        <th className="w-28 py-3 px-4">Phân loại</th>
                        <th className="w-16 py-3 px-4 text-center">ĐVT</th>
                        <th className="w-16 py-3 px-4 text-center">SL</th>
                        <th className="w-28 py-3 px-4 text-right">Đơn giá</th>
                        <th className="w-24 py-3 px-4 text-right">Chiết khấu</th>
                        <th className="w-28 py-3 px-4 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detail.items.map((item, idx) => (
                        <tr key={item.quotationItemId}>
                          <td className="py-3 px-4 text-center font-medium text-slate-500">{idx + 1}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{item.itemName}</td>
                          <td className="py-3 px-4 text-slate-600">{item.categoryName}</td>
                          <td className="py-3 px-4 text-center text-slate-600">{item.unit}</td>
                          <td className="py-3 px-4 text-center font-bold text-slate-800">{item.quantity}</td>
                          <td className="py-3 px-4 text-right text-slate-700">{formatCurrency(item.price)}</td>
                          <td className="py-3 px-4 text-right font-medium text-red-600">-{formatCurrency(item.discount)}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-950">{formatCurrency(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="mt-6 flex justify-end">
              <div className="w-full max-w-xs space-y-2 border-t border-slate-100 pt-4 text-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Tổng tiền dịch vụ:</span>
                  <span className="font-medium text-slate-800">{formatCurrency(isEditingItems ? editSubtotal : detail.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Khấu trừ giảm giá:</span>
                  <span className="font-semibold text-red-600">-{formatCurrency(isEditingItems ? editDiscountTotal : detail.discountTotal)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 text-base">
                  <span className="font-black text-slate-900">Thành tiền (VND):</span>
                  <span className="text-xl font-bold text-blue-600">{formatCurrency(isEditingItems ? editTotalAmount : detail.totalAmount)}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Pagination dots — chuyển giữa "Báo giá chính thức" và "Picklist chi tiết" */}
      {!isEditingItems && (
        <div className="mx-auto my-4 flex max-w-4xl flex-col items-center justify-center gap-2 border-y border-slate-100 py-4 print:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDetailPage(1)}
              title="Trang 1: Báo giá chính thức"
              className={`h-3.5 w-3.5 rounded-full transition-all focus:outline-none ${detailPage === 1 ? 'scale-125 bg-blue-600 ring-4 ring-blue-100' : 'bg-slate-300 hover:bg-slate-400'}`}
            />
            <button
              type="button"
              onClick={() => setDetailPage(2)}
              title="Trang 2: Danh sách hạng mục cần chuẩn bị"
              className={`h-3.5 w-3.5 rounded-full transition-all focus:outline-none ${detailPage === 2 ? 'scale-125 bg-blue-600 ring-4 ring-blue-100' : 'bg-slate-300 hover:bg-slate-400'}`}
            />
          </div>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {detailPage === 1 ? 'Đang xem: Trang 1/2 — Bản đề xuất báo giá chính thức' : 'Đang xem: Trang 2/2 — Danh sách hạng mục cần chuẩn bị'}
          </p>
        </div>
      )}

      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Xóa báo giá"
        subtitle={`Bạn có chắc muốn xóa báo giá ${detail.quotationCode}? Hành động này không thể hoàn tác.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsDeleteOpen(false)} disabled={isDeleting}>
              Hủy
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} isLoading={isDeleting}>
              Xóa báo giá
            </Button>
          </>
        }
      >
        <div />
      </Modal>

      <CreateOrderFromQuotationModal
        isOpen={isCreateOrderOpen}
        onClose={() => setIsCreateOrderOpen(false)}
        quotation={detail}
        onCreated={(orderId) => {
          setIsCreateOrderOpen(false);
          router.push(`/manager/orders/${orderId}`);
        }}
      />
    </div>
  );
}
