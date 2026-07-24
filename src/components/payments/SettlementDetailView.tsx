'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { AxiosError } from 'axios';
import { Calendar, Check, Copy, Download, MapPin, Phone } from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Reveal from '@/components/ui/Reveal';
import { formatCurrency } from '@/utils/formatCurrency';
import { orderApiService } from '@/services/order.service';
import { paymentApiService } from '@/services/payment.service';
import { settlementApiService } from '@/services/settlement.service';
import { PAYMENT_METHOD_OPTIONS, paymentMethodLabel } from '@/constants/deposit-status';
import { SETTLEMENT_STATUS_LABEL, SETTLEMENT_STATUS_VARIANT } from '@/constants/settlement-status';
import { ORDER_PAYMENT_STATUS_LABEL } from '@/constants/order-status';
import { COMPANY_BANK_ACCOUNT, buildVietQrImageUrl } from '@/constants/company-bank';
import { formatDate } from '@/utils/formatDate';
import type { Order } from '@/types/order';
import type { Deposit } from '@/types/payment';
import type { Settlement } from '@/types/settlement';

// Nối API thật (2026-07-21) — thay thế màn mock cũ (`mocks/db/payments.ts`), đúng pattern đã áp dụng
// cho `DepositDetailView.tsx` (docs/datcoc_api.md). `[id]` trên URL là orderId (giữ nguyên quy ước cũ).
// POST /orders/:id/settlement server tự tính finalAmount = totalAmount + additionalFee + compensation
// - depositAmount(SUCCESS) - discount, chỉ trả về 1 bản ghi MỚI NHẤT/đơn (không phải lịch sử nhiều bản
// ghi như Deposit) — xác nhận qua curl: gọi POST nhiều lần trên cùng đơn trả về CÙNG 1 settlementId
// (cập nhật lại bản DRAFT hiện có thay vì tạo bản mới). Luồng xác nhận giống hệt Mốc 5 đã nối ở
// order/[id]/page.tsx: PUT .../confirm rồi tự gọi thêm PUT /orders/:id/status COMPLETED.

interface SettlementDetailViewProps {
  /** Manager: đầy đủ lập/điều chỉnh/xác nhận. Admin: chỉ xem (CLAUDE.md — Admin không xử lý vận hành). */
  canManage: boolean;
  backHref: string;
}

export default function SettlementDetailView({ canManage, backHref }: Readonly<SettlementDetailViewProps>) {
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [additionalFee, setAdditionalFee] = useState('0');
  const [compensation, setCompensation] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const load = () => {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([
      orderApiService.getOrder(orderId),
      paymentApiService.getOrderDeposits(orderId).catch(() => ({ data: [] })),
      settlementApiService.getOrderSettlement(orderId).catch(() => ({ data: null })),
    ])
      .then(([orderRes, depositsRes, settlementRes]) => {
        setOrder(orderRes.data ?? null);
        setDeposits(depositsRes.data ?? []);
        const s: Settlement | null = settlementRes.data ?? null;
        setSettlement(s);
        setAdditionalFee(String(s?.additionalFee ?? 0));
        setCompensation(String(s?.compensation ?? 0));
        setDiscount(String(s?.discount ?? 0));
        setPaymentMethod(s?.paymentMethod ?? 'cash');
        setNotes(s?.notes ?? '');
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
        <p className="text-sm text-slate-400">Đang tải thông tin quyết toán...</p>
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

  const depositCollected = deposits.filter((d) => d.status === 'SUCCESS').reduce((sum, d) => sum + d.amount, 0);
  const estimatedFinal =
    order.totalAmount + (Number(additionalFee) || 0) + (Number(compensation) || 0) - depositCollected - (Number(discount) || 0);
  const displayAmount = settlement ? settlement.finalAmount : estimatedFinal;
  const transferContent = `${order.orderCode} QUYET TOAN`;
  const qrImageUrl = buildVietQrImageUrl({ amount: Math.max(0, displayAmount), addInfo: transferContent });

  const handleCopy = () => {
    navigator.clipboard?.writeText(transferContent).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownloadQr = async () => {
    try {
      const res = await fetch(qrImageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vietqr-quyet-toan-${order.orderCode}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(qrImageUrl, '_blank');
    }
  };

  const handleSaveSettlement = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await settlementApiService.recordSettlement(orderId, {
        additionalFee: Number(additionalFee) || 0,
        compensation: Number(compensation) || 0,
        discount: Number(discount) || 0,
        paymentMethod,
        notes: notes.trim() || undefined,
      });
      load();
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setSaveError(axiosError.response?.data?.message ?? 'Không thể lập biên bản quyết toán. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmSettlement = async () => {
    if (!settlement) return;
    setIsConfirming(true);
    try {
      await settlementApiService.confirmSettlement(settlement.settlementId, { status: 'CONFIRMED' });
      await orderApiService.updateOrderStatus(order.orderId, { orderStatus: 'COMPLETED' });
      load();
    } finally {
      setIsConfirming(false);
    }
  };

  const isConfirmed = settlement?.status === 'CONFIRMED';

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <BackButton href={backHref} />
        <Breadcrumb
          items={[
            { label: 'Quyết toán' },
            { label: 'Danh sách quyết toán', href: backHref },
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
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Đã thu tạm ứng cọc</p>
              <p className="mt-1 text-lg font-bold text-emerald-400">{formatCurrency(depositCollected)}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Trạng thái thanh toán</p>
              <p className="mt-1 text-lg font-bold text-white">{ORDER_PAYMENT_STATUS_LABEL[order.paymentStatus]}</p>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Reveal delay={0.05} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              Hồ sơ quyết toán cuối kỳ
            </p>
            {settlement && <Badge variant={SETTLEMENT_STATUS_VARIANT[settlement.status]}>{SETTLEMENT_STATUS_LABEL[settlement.status]}</Badge>}
          </div>

          {settlement && (
            <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Số tiền quyết toán cuối</p>
                <p className="mt-1 font-bold text-slate-900">{formatCurrency(settlement.finalAmount)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Phương thức</p>
                <p className="mt-1 font-semibold text-slate-800">{paymentMethodLabel(settlement.paymentMethod)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ngày xác nhận</p>
                <p className={`mt-1 font-semibold ${settlement.confirmedAt ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {settlement.confirmedAt ? formatDate(settlement.confirmedAt) : '—'}
                </p>
              </div>
            </div>
          )}

          {!settlement && !canManage && (
            <p className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
              Đơn này chưa có biên bản quyết toán nào.
            </p>
          )}

          {canManage && !isConfirmed && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input type="number" label="Phụ thu phát sinh" value={additionalFee} onChange={(e) => setAdditionalFee(e.target.value)} />
                <Input
                  type="number"
                  label="Bồi thường hư hỏng/mất"
                  value={compensation}
                  onChange={(e) => setCompensation(e.target.value)}
                />
                <Input type="number" label="Giảm trừ/Ưu đãi" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
              <Select
                label="Phương thức thanh toán"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                options={PAYMENT_METHOD_OPTIONS}
              />
              <div className="flex flex-col gap-1">
                <label htmlFor="settlement-notes" className="text-sm font-medium text-gray-700">
                  Ghi chú
                </label>
                <textarea
                  id="settlement-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="block w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm">
                <span className="font-semibold text-slate-600">Ước tính cần thu cuối:</span>
                <span className="text-lg font-extrabold text-blue-600">{formatCurrency(estimatedFinal)}</span>
              </div>

              {saveError && <p className="text-sm text-red-600">{saveError}</p>}

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSaveSettlement} isLoading={isSaving}>
                  {settlement ? 'Cập nhật biên bản quyết toán' : 'Lập biên bản quyết toán'}
                </Button>
                {settlement && (
                  <Button variant="secondary" onClick={handleConfirmSettlement} isLoading={isConfirming}>
                    <Check className="h-4 w-4" />
                    Xác nhận thu nốt &amp; Quyết toán
                  </Button>
                )}
              </div>
            </div>
          )}

          {isConfirmed && (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              Đã xác nhận quyết toán — đơn hàng đã chuyển sang trạng thái Hoàn thành.
            </p>
          )}

          {settlement?.notes && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500">Ghi chú</p>
              <p className="mt-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{settlement.notes}</p>
            </div>
          )}
        </Reveal>

        <Reveal delay={0.1} className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-bold text-slate-900">Cổng thanh toán VietQR</p>
          <p className="mt-1 text-xs text-slate-400">Quét mã bằng app ngân hàng/Mobile Banking để chuyển khoản nhanh, đúng tài khoản và nội dung.</p>

          <div className="mt-4 flex justify-center">
            <div className="w-full max-w-[220px] rounded-xl border border-slate-200 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh động từ img.vietqr.io, không phải asset tĩnh trong repo */}
              <img src={qrImageUrl} alt={`Mã VietQR chuyển khoản quyết toán ${order.orderCode}`} className="w-full" />
            </div>
          </div>

          <div className="mt-3 space-y-1 text-center text-xs text-slate-500">
            <p className="font-semibold text-slate-700">{COMPANY_BANK_ACCOUNT.bankName}</p>
            <p>
              STK: <span className="font-mono font-semibold text-slate-700">{COMPANY_BANK_ACCOUNT.accountNumber}</span>
            </p>
            <p>{COMPANY_BANK_ACCOUNT.accountName}</p>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-slate-400">Số tiền cần đóng</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(Math.max(0, displayAmount))}</p>
          </div>

          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-400">Nội dung bắt buộc:</p>
            <p className="mt-0.5 break-all font-mono text-sm font-semibold text-slate-700">{transferContent}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={handleDownloadQr}>
              <Download className="h-4 w-4" />
              Tải mã QR
            </Button>
            <Button onClick={handleCopy}>
              <Copy className="h-4 w-4" />
              {copied ? 'Đã chép!' : 'Sao chép'}
            </Button>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
