'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { AxiosError } from 'axios';
import { Ban, Calendar, Check, Copy, Download, MapPin, Phone, Plus } from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import Reveal from '@/components/ui/Reveal';
import { parseApiError } from '@/utils/apiError';
import { EvidenceBlock, EvidenceUploadField, uploadPaymentEvidence } from '@/components/payments/EvidenceBlock';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import { orderApiService } from '@/services/order.service';
import { paymentApiService } from '@/services/payment.service';
import { surveyApiService } from '@/services/survey.service';
import { DEPOSIT_STATUS_LABEL, paymentMethodLabel } from '@/constants/deposit-status';
import { ORDER_PAYMENT_STATUS_LABEL } from '@/constants/order-status';
import { buildSepayQrUrl } from '@/constants/company-bank';
import { useBankAccount } from '@/hooks/useBankAccount';
import type { Order } from '@/types/order';
import type { Deposit } from '@/types/payment';
import type { SurveyReportListItem } from '@/types/survey';

// Nối API thật theo docs/datcoc_api.md — `[id]` trên URL vẫn quy ước là orderId (giữ nguyên hành vi
// mock cũ), gọi GET /orders/:id (banner) + GET /orders/:id/deposits (danh sách hồ sơ cọc — API trả
// MẢNG, 1 đơn có thể có NHIỀU hồ sơ, mục 4.6 của doc — hiển thị dạng lịch sử thay vì giả định chỉ 1).
//
// 2 field không có cách set/sửa qua PUT (đã re-test qua curl 2026-07-21, xem types/payment.ts):
// amount, notes đều bị bỏ qua ở PUT /deposits/:id — đã BỎ HẲN UI "sửa số tiền cọc" khỏi trang chi
// tiết, chỉ còn tạo yêu cầu mới (nơi amount/notes/dueDate/paymentMethod đều lưu được thật) và đổi
// trạng thái. `evidenceIds` KHÁC 2 field trên — backend 2026-08-06 (commit d0db32a, docs/more-require.md
// mục ay) đã cho ghi được, nhưng chỉ CÙNG LÚC đổi status (không có API gắn riêng lẻ) — xem
// `EvidenceUploadField`/`uploadPaymentEvidence` ở modal "Xác nhận đã nhận cọc" bên dưới.
//
// Cập nhật 2026-07-21: khối "Cổng thanh toán VietQR" đổi từ mã giả (hoa văn ngẫu nhiên) sang mã VietQR
// THẬT qua "Quick Link" công khai của img.vietqr.io (constants/company-bank.ts, không cần đăng ký/API
// key) — quét được thật bằng app ngân hàng, chuyển đúng tài khoản/số tiền/nội dung. Tài khoản ngân
// hàng công ty hiện hardcode ở FE (do người dùng cung cấp trực tiếp) vì backend chưa có bảng cấu hình
// nào cho việc này — đã ghi yêu cầu bổ sung vào docs/api_can_them.md. Gắn theo hồ sơ cọc UNPAID gần
// nhất (hoặc hồ sơ mới nhất nếu không còn cái nào UNPAID).

function getDepositTransferContent(depositCode: string, orderCode: string): string {
  return `${depositCode} CHUYEN KHOAN DAT COC ${orderCode}`;
}

function getTodayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface DepositDetailViewProps {
  /** Manager: đầy đủ tạo/xác nhận/hủy. Admin: chỉ xem — backend cũng chặn 403 nếu cố ghi (xem
   * docs/datcoc_api.md mục 7, đã xác nhận qua curl). */
  canManage: boolean;
  backHref: string;
}

export default function DepositDetailView({ canManage, backHref }: Readonly<DepositDetailViewProps>) {
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const { account: bankAccount } = useBankAccount();
  const [order, setOrder] = useState<Order | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [surveyReport, setSurveyReport] = useState<SurveyReportListItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const todayDateInputValue = getTodayDateInputValue();

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [confirmEvidenceFile, setConfirmEvidenceFile] = useState<File | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const load = () => {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([orderApiService.getOrder(orderId), paymentApiService.getOrderDeposits(orderId)])
      .then(([orderRes, depositsRes]) => {
        const orderData = orderRes.data ?? null;
        setOrder(orderData);
        setDeposits(([...(depositsRes.data ?? [])] as Deposit[]).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));

        if (orderData) {
          surveyApiService
            .getSurveyReports({ search: orderData.orderCode })
            .then((surveyRes) => {
              const surveys = (surveyRes.data ?? []) as SurveyReportListItem[];
              setSurveyReport(surveys.find((s) => s.orderId === orderId) ?? null);
            })
            .catch(() => setSurveyReport(null));
        }
      })
      .catch(() => {
        setOrder(null);
        setLoadError('Không tải được thông tin đơn đặt.');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-400">Đang tải thông tin đặt cọc...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">{loadError ?? 'Không tìm thấy đơn đặt.'}</p>
        <Link href={backHref} className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const totalReceived = deposits.filter((d) => d.status === 'PAID').reduce((sum, d) => sum + d.amount, 0);
  const hasPendingDeposit = deposits.some((d) => d.status === 'UNPAID');
  // QR minh họa gắn theo hồ sơ cọc còn đang chờ thanh toán (ưu tiên) — nếu không còn cái nào UNPAID
  // (đã xác nhận/hủy hết) thì hiện theo hồ sơ mới nhất để vẫn có nội dung tham khảo.
  const primaryDeposit = deposits.find((d) => d.status === 'UNPAID') ?? deposits[0] ?? null;

  const handleCopy = (depositId: string, content: string) => {
    navigator.clipboard?.writeText(content).catch(() => undefined);
    setCopiedId(depositId);
    setTimeout(() => setCopiedId((cur) => (cur === depositId ? null : cur)), 1500);
  };

  const handleDownloadQr = async (imageUrl: string, depositCode: string) => {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vietqr-${depositCode}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // Ảnh vẫn hiện được trên trang (thẻ <img> tải trực tiếp từ img.vietqr.io) — chỉ riêng bước tải
      // về máy có thể lỗi nếu mạng chặn CORS, mở trực tiếp link ảnh làm phương án dự phòng.
      window.open(imageUrl, '_blank');
    }
  };

  const openCreateForm = () => {
    setAmount('');
    setDueDate('');
    setNotes('');
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const handleCreateDeposit = async () => {
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setCreateError('Vui lòng nhập số tiền cọc hợp lệ.');
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      await paymentApiService.createOrderDeposit(orderId, {
        amount: amountNum,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        notes: notes.trim() || undefined,
      });
      setIsCreateOpen(false);
      load();
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setCreateError(axiosError.response?.data?.message ?? 'Không thể tạo yêu cầu đặt cọc. Vui lòng thử lại.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirm = async (depositId: string) => {
    setIsUpdatingStatus(true);
    setConfirmError(null);
    try {
      const evidenceIds = confirmEvidenceFile ? [await uploadPaymentEvidence(confirmEvidenceFile)] : undefined;
      await paymentApiService.updateDepositStatus(depositId, { status: 'PAID', evidenceIds });
      // Backend không tự chuyển orderStatus khi xác nhận cọc (chỉ nâng paymentStatus lên DEPOSITED,
      // xem docs/datcoc_api.md) — nếu đơn còn "Mới" thì đẩy sang "Đã xác nhận" luôn từ phía FE để
      // tránh lệch pha "Thanh toán: Đã cọc" / "Đơn hàng: Mới" trên bảng Danh sách đơn.
      if (order?.orderStatus === 'NEW') {
        await orderApiService.updateOrderStatus(orderId, { orderStatus: 'CONFIRMED' });
      }
      setConfirmingId(null);
      setConfirmEvidenceFile(null);
      load();
    } catch (err) {
      // 409 overbooking (kho không đủ cho khoảng của đơn) hiện rõ item + khả dụng; lỗi khác giữ message chung.
      setConfirmError(parseApiError(err, 'Không thể xác nhận đặt cọc. Vui lòng thử lại.'));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCancel = async (depositId: string) => {
    setIsUpdatingStatus(true);
    try {
      await paymentApiService.updateDepositStatus(depositId, { status: 'CANCELLED' });
      setCancelingId(null);
      load();
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <BackButton href={backHref} />
        <Breadcrumb
          items={[
            { label: 'Đặt cọc' },
            { label: 'Danh sách đặt cọc', href: backHref },
            { label: order.orderCode },
          ]}
        />
      </div>

      <Reveal className="rounded-2xl bg-[#0F172A] p-6 text-white">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <span className="inline-flex rounded-full bg-indigo-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-indigo-300">
              {order.orderCode}
            </span>
            <h1 className="mt-2 text-2xl font-bold text-white">{order.eventName || order.eventType}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-300">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatDate(order.eventDate)}
                {order.endDate ? ` — ${formatDate(order.endDate)}` : ''}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {order.location}
              </span>
            </div>
            <div className="mt-4">
              <p className="font-semibold text-white">Khách hàng: {order.customerName}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-300">
                <Phone className="h-3.5 w-3.5" />
                {order.customerPhone}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-[520px]">
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Tổng giá trị đơn</p>
              <p className="mt-1 text-lg font-bold text-white">{formatCurrency(order.totalAmount)}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Tổng cọc đã nhận</p>
              <p className="mt-1 text-lg font-bold text-emerald-400">{formatCurrency(totalReceived)}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Trạng thái thanh toán</p>
              <p className="mt-1 text-lg font-bold text-white">{ORDER_PAYMENT_STATUS_LABEL[order.paymentStatus]}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm">
          <p className="text-slate-300">
            Người tạo đơn: <span className="font-bold text-white">{order.createdBy.fullName}</span>
          </p>
        </div>
      </Reveal>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <Reveal delay={0.05} className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            Lịch sử yêu cầu đặt cọc
          </p>
          {canManage && (
            <Button
              size="sm"
              onClick={openCreateForm}
              disabled={hasPendingDeposit}
              title={hasPendingDeposit ? 'Đã có 1 yêu cầu cọc đang chờ xử lý — xác nhận hoặc hủy trước khi tạo yêu cầu mới' : undefined}
            >
              <Plus className="h-4 w-4" />
              Tạo yêu cầu cọc mới
            </Button>
          )}
        </div>

        {deposits.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
            Đơn này chưa có yêu cầu đặt cọc nào.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {deposits.map((d) => {
              const transferContent = getDepositTransferContent(d.depositCode, order.orderCode);
              return (
                <div key={d.depositId} className="rounded-xl border border-slate-150 bg-white p-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-slate-900">{d.depositCode}</p>
                    <Badge variant={getStatusBadgeVariant(d.status)}>{DEPOSIT_STATUS_LABEL[d.status]}</Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Số tiền cọc</p>
                      <p className="mt-1 font-bold text-slate-900">{formatCurrency(d.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Hạn thanh toán</p>
                      <p className="mt-1 font-semibold text-slate-800">{d.dueDate ? formatDate(d.dueDate) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ngày thanh toán</p>
                      <p className={`mt-1 font-semibold ${d.paymentDate ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {d.paymentDate ? formatDate(d.paymentDate) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Phương thức</p>
                      <p className="mt-1 font-semibold text-slate-800">{paymentMethodLabel(d.paymentMethod)}</p>
                    </div>
                  </div>

                  {d.notes && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-slate-500">Ghi chú</p>
                      <p className="mt-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{d.notes}</p>
                    </div>
                  )}

                  <div className="mt-3">
                    <p className="text-xs font-semibold text-slate-500">Nội dung chuyển khoản </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <span className="truncate font-mono text-sm uppercase text-slate-700">{transferContent}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(d.depositId, transferContent)}
                        aria-label="Sao chép nội dung"
                        className="shrink-0 text-slate-400 hover:text-blue-600"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    {copiedId === d.depositId && <p className="mt-1 text-xs text-emerald-600">Đã sao chép!</p>}
                  </div>

                  <EvidenceBlock
                    evidenceIds={d.evidenceIds ?? []}
                    title="Bằng chứng thanh toán"
                    emptyLabel="Chưa có ảnh minh chứng thanh toán."
                  />

                  {canManage && d.status === 'UNPAID' && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                      <Button
                        size="sm"
                        onClick={() => {
                          setConfirmEvidenceFile(null);
                          setConfirmError(null);
                          setConfirmingId(d.depositId);
                        }}
                      >
                        <Check className="h-4 w-4" />
                        Xác nhận đã nhận cọc
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setCancelingId(d.depositId)}>
                        <Ban className="h-4 w-4" />
                        Hủy yêu cầu
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Reveal>

      <Reveal delay={0.1} className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-bold text-slate-900">Cổng thanh toán QR (SePay)</p>
        {/* <p className="mt-1 text-xs text-slate-400">Quét mã bằng app ngân hàng/Mobile Banking để chuyển khoản nhanh, đúng tài khoản và nội dung.</p> */}

        {primaryDeposit ? (
          (() => {
            const transferContent = getDepositTransferContent(primaryDeposit.depositCode, order.orderCode);
            const bankConfigured = Boolean(bankAccount?.configured && bankAccount.bankBin && bankAccount.accountNumber);
            const qrImageUrl = bankConfigured
              ? buildSepayQrUrl(
                  { bankBin: bankAccount!.bankBin!, accountNumber: bankAccount!.accountNumber!, accountName: bankAccount!.accountName },
                  { amount: primaryDeposit.amount, des: transferContent },
                )
              : null;
            return (
              <>
                {bankConfigured && qrImageUrl ? (
                  <>
                    <div className="mt-4 flex justify-center">
                      <div className="w-full max-w-[220px] rounded-xl border border-slate-200 p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh động từ SePay (qr.sepay.vn), không phải asset tĩnh trong repo */}
                        <img src={qrImageUrl} alt={`Mã QR chuyển khoản cọc ${primaryDeposit.depositCode}`} className="w-full" />
                      </div>
                    </div>

                    <div className="mt-3 space-y-1 text-center text-xs text-slate-500">
                      <p className="font-semibold text-slate-700">{bankAccount?.bankName}</p>
                      <p>
                        STK: <span className="font-mono font-semibold text-slate-700">{bankAccount?.accountNumber}</span>
                      </p>
                      <p>{bankAccount?.accountName}</p>
                    </div>
                  </>
                ) : (
                  <div className="mt-4 rounded-lg bg-amber-50 p-3 text-center text-xs text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    Chưa cấu hình tài khoản ngân hàng công ty — vui lòng liên hệ Admin cấu hình tại <span className="font-semibold">Cấu hình &gt; Tài khoản ngân hàng</span> để hiển thị mã QR chuyển khoản.
                  </div>
                )}

                <div className="mt-4 text-center">
                  <p className="text-xs text-slate-400">Số tiền cần đóng</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(primaryDeposit.amount)}</p>
                </div>

                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs text-slate-400">Nội dung bắt buộc:</p>
                  <p className="mt-0.5 break-all font-mono text-sm font-semibold text-slate-700">{transferContent}</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="secondary" disabled={!bankConfigured} onClick={() => qrImageUrl && handleDownloadQr(qrImageUrl, primaryDeposit.depositCode)}>
                    <Download className="h-4 w-4" />
                    Tải mã QR
                  </Button>
                  <Button onClick={() => handleCopy(primaryDeposit.depositId, transferContent)}>
                    <Copy className="h-4 w-4" />
                    {copiedId === primaryDeposit.depositId ? 'Đã chép!' : 'Sao chép'}
                  </Button>
                </div>
              </>
            );
          })()
        ) : (
          <p className="mt-4 text-center text-sm italic text-slate-400">Chưa có yêu cầu cọc nào để tạo mã QR.</p>
        )}
      </Reveal>
      </div>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tạo yêu cầu đặt cọc"
        subtitle={`Ghi nhận yêu cầu tạm ứng cọc mới cho đơn ${order.orderCode}.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
              Hủy
            </Button>
            <Button onClick={handleCreateDeposit} isLoading={isCreating}>
              Tạo yêu cầu
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input type="number" label="Số tiền cọc (đ)" required min={1} step={100_000} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input type="date" label="Hạn thanh toán" min={todayDateInputValue} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <div className="flex flex-col gap-1">
            <label htmlFor="deposit-notes" className="text-sm font-medium text-gray-700">
              Ghi chú
            </label>
            <textarea
              id="deposit-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="block w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {createError && <p className="text-sm text-red-600">{createError}</p>}
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(confirmingId)}
        onClose={() => {
          setConfirmingId(null);
          setConfirmEvidenceFile(null);
        }}
        title="Xác nhận đã nhận cọc?"
        subtitle="Đơn sẽ tự chuyển trạng thái thanh toán sang Đã đặt cọc. Không thể sửa lại sau khi xác nhận."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmingId(null);
                setConfirmEvidenceFile(null);
              }}
              disabled={isUpdatingStatus}
            >
              Đóng
            </Button>
            <Button onClick={() => confirmingId && handleConfirm(confirmingId)} isLoading={isUpdatingStatus}>
              Xác nhận
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <EvidenceUploadField file={confirmEvidenceFile} onChange={setConfirmEvidenceFile} disabled={isUpdatingStatus} />
          {confirmError && <p className="text-sm text-red-600">{confirmError}</p>}
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(cancelingId)}
        onClose={() => setCancelingId(null)}
        title="Hủy yêu cầu đặt cọc?"
        subtitle="Yêu cầu sẽ chuyển sang trạng thái Đã hủy, không thể khôi phục lại."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelingId(null)} disabled={isUpdatingStatus}>
              Đóng
            </Button>
            <Button variant="danger" onClick={() => cancelingId && handleCancel(cancelingId)} isLoading={isUpdatingStatus}>
              Hủy yêu cầu
            </Button>
          </>
        }
      >
        <div />
      </Modal>
    </div>
  );
}
