'use client';

import { useState } from 'react';
import { CheckCircle2, CircleX, Flag, PackageCheck, type LucideIcon } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { supplierApiService } from '@/services/supplier.service';
import type { SupplierTransaction } from '@/types/supplier';
import {
  SUPPLIER_TRANSACTION_NEXT_STATUSES,
  SUPPLIER_TRANSACTION_STATUS_META,
  type SupplierTransactionStatus,
} from '@/constants/supplier-transaction-status';
import toast from 'react-hot-toast';

// Nút thao tác chuyển trạng thái đơn thuê/mua NCC — nguồn hành động DUY NHẤT (tái dùng ở list + modal chi
// tiết). Chỉ hiện các trạng thái đích HỢP LỆ theo máy trạng thái (SUPPLIER_TRANSACTION_NEXT_STATUSES,
// khớp guard BE). Hành động không hoàn tác (Hoàn thành / Hủy) phải qua modal xác nhận. Chỉ dùng ở phía
// Manager — Admin là vai trò kiểm toán, không thao tác vận hành.

type TargetStatus = Exclude<SupplierTransactionStatus, 'PENDING'>; // các trạng thái có thể là ĐÍCH

const ACTION_META: Record<TargetStatus, { label: string; icon: LucideIcon; variant: 'primary' | 'danger'; confirm: boolean }> = {
  APPROVED: { label: 'Duyệt', icon: CheckCircle2, variant: 'primary', confirm: false },
  RECEIVED: { label: 'Đã nhận', icon: PackageCheck, variant: 'primary', confirm: false },
  COMPLETED: { label: 'Hoàn thành', icon: Flag, variant: 'primary', confirm: true },
  CANCELLED: { label: 'Hủy đơn', icon: CircleX, variant: 'danger', confirm: true },
};

const CONFIRM_TEXT: Partial<Record<SupplierTransactionStatus, string>> = {
  COMPLETED: 'Đánh dấu HOÀN THÀNH đơn thuê/mua này? Sau khi hoàn thành sẽ không thể đổi trạng thái nữa.',
  CANCELLED: 'HỦY đơn thuê/mua này? Thao tác không thể hoàn tác. Đơn đã hủy sẽ được trừ khỏi công nợ nhà cung cấp.',
};

/** Icon-button vuông 32x32 (bo góc 8px), kiểu ghost — dùng cho "Duyệt"/"Hoàn thành" ở variant="icons". */
const ICON_BUTTON_STYLE: Partial<Record<TargetStatus, string>> = {
  APPROVED: 'text-slate-400 hover:bg-blue-50 hover:text-blue-600',
  COMPLETED: 'text-slate-400 hover:bg-blue-50 hover:text-blue-600',
};

/**
 * "Đã nhận"/"Hủy đơn" render dạng button compact có chữ (không icon-only) ở variant="icons" — theo
 * yêu cầu thiết kế cụ thể cho 2 hành động này, màu hiện thường trực (không chỉ khi hover).
 */
const TEXT_BUTTON_STATUSES = new Set<TargetStatus>(['RECEIVED', 'CANCELLED']);
const TEXT_BUTTON_STYLE: Partial<Record<TargetStatus, string>> = {
  RECEIVED: 'border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100',
  CANCELLED: 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
};

interface Props {
  transaction: SupplierTransaction;
  onDone: () => void; // gọi sau khi chuyển trạng thái thành công (để refetch)
  size?: 'sm' | 'md';
  className?: string;
  /**
   * 'icons' = layout gọn dùng ở cột "Thao tác" trên bảng danh sách: "Duyệt"/"Hoàn thành" render
   * icon-button vuông 32x32 có tooltip (title); "Đã nhận"/"Hủy đơn" render button compact có chữ
   * (icon + label, cao 32px) — màu xanh/đỏ hiện thường trực. Tối đa 2 hành động cùng lúc (xem
   * SUPPLIER_TRANSACTION_NEXT_STATUSES) nên không kéo cao row. Mặc định 'buttons' (dàn hàng ngang
   * đầy đủ label cho mọi hành động, dùng ở modal chi tiết).
   */
  variant?: 'buttons' | 'icons';
}

export default function SupplierTransactionStatusActions({ transaction, onDone, size = 'sm', className = '', variant = 'buttons' }: Readonly<Props>) {
  const [pendingTarget, setPendingTarget] = useState<TargetStatus | null>(null); // đang chờ xác nhận
  const [submitting, setSubmitting] = useState<TargetStatus | null>(null);

  const nexts = (SUPPLIER_TRANSACTION_NEXT_STATUSES[transaction.status as SupplierTransactionStatus] ?? []) as TargetStatus[];
  if (nexts.length === 0) return null; // COMPLETED/CANCELLED — điểm cuối, không còn hành động

  const runTransition = async (target: TargetStatus) => {
    setSubmitting(target);
    try {
      await supplierApiService.updateTransactionStatus(transaction.transactionId, target);
      toast.success(`Đã chuyển sang "${SUPPLIER_TRANSACTION_STATUS_META[target].label}"`);
      setPendingTarget(null);
      onDone();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Không thể đổi trạng thái. Vui lòng thử lại.');
    } finally {
      setSubmitting(null);
    }
  };

  const handleClick = (target: TargetStatus) => {
    if (ACTION_META[target].confirm) setPendingTarget(target);
    else void runTransition(target);
  };

  return (
    <>
      {variant === 'icons' ? (
        // Xếp dọc (trên-dưới) khi có ≥2 hành động cùng lúc — đỡ chiếm bề ngang của cột "Thao tác".
        <div className={`flex flex-col items-start gap-1 ${className}`}>
          {nexts.map((target) => {
            const meta = ACTION_META[target];
            const Icon = meta.icon;
            const isTextButton = TEXT_BUTTON_STATUSES.has(target);
            const spinner = (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            );
            if (isTextButton) {
              return (
                <button
                  key={target}
                  type="button"
                  disabled={submitting !== null}
                  onClick={() => handleClick(target)}
                  className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${TEXT_BUTTON_STYLE[target]}`}
                >
                  {submitting === target ? spinner : <Icon className="h-3.5 w-3.5" />}
                  {meta.label}
                </button>
              );
            }
            return (
              <button
                key={target}
                type="button"
                aria-label={meta.label}
                title={meta.label}
                disabled={submitting !== null}
                onClick={() => handleClick(target)}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ICON_BUTTON_STYLE[target]}`}
              >
                {submitting === target ? spinner : <Icon className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className={`flex flex-wrap items-center gap-2 ${className}`}>
          {nexts.map((target) => {
            const meta = ACTION_META[target];
            const Icon = meta.icon;
            return (
              <Button
                key={target}
                type="button"
                size={size}
                variant={meta.variant}
                isLoading={submitting === target}
                disabled={submitting !== null}
                onClick={() => handleClick(target)}
              >
                <Icon className="h-4 w-4" />
                {meta.label}
              </Button>
            );
          })}
        </div>
      )}

      {pendingTarget && (
        <Modal
          isOpen
          onClose={() => submitting === null && setPendingTarget(null)}
          title={`${ACTION_META[pendingTarget].label} đơn thuê/mua`}
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setPendingTarget(null)} disabled={submitting !== null}>
                Hủy bỏ
              </Button>
              <Button
                variant={ACTION_META[pendingTarget].variant}
                isLoading={submitting !== null}
                onClick={() => void runTransition(pendingTarget)}
              >
                Xác nhận
              </Button>
            </div>
          }
        >
          <p className="text-sm text-slate-600">{CONFIRM_TEXT[pendingTarget]}</p>
          <p className="mt-3 text-xs text-slate-400">
            Đơn: <span className="font-semibold text-slate-600">{transaction.transactionCode}</span> · {transaction.supplierName}
          </p>
        </Modal>
      )}
    </>
  );
}
