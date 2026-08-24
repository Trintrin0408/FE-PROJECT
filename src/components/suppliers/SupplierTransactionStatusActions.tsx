'use client';

import { useState } from 'react';
import { CheckCircle2, Flag, PackageCheck, XCircle, type LucideIcon } from 'lucide-react';
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
  CANCELLED: { label: 'Hủy đơn', icon: XCircle, variant: 'danger', confirm: true },
};

const CONFIRM_TEXT: Partial<Record<SupplierTransactionStatus, string>> = {
  COMPLETED: 'Đánh dấu HOÀN THÀNH đơn thuê/mua này? Sau khi hoàn thành sẽ không thể đổi trạng thái nữa.',
  CANCELLED: 'HỦY đơn thuê/mua này? Thao tác không thể hoàn tác. Đơn đã hủy sẽ được trừ khỏi công nợ nhà cung cấp.',
};

/** Ghost icon-button 32x32 — cùng kiểu với nút Sửa/Xóa ở cột "Thao tác" của bảng danh sách. */
const ICON_BUTTON_HOVER: Record<'primary' | 'danger', string> = {
  primary: 'hover:bg-blue-50 hover:text-blue-600',
  danger: 'hover:bg-red-50 hover:text-red-600',
};

interface Props {
  transaction: SupplierTransaction;
  onDone: () => void; // gọi sau khi chuyển trạng thái thành công (để refetch)
  size?: 'sm' | 'md';
  className?: string;
  /**
   * 'icons' render mỗi hành động thành 1 icon-button 32x32 có tooltip (title) thay vì nút full-text
   * — dùng ở cột "Thao tác" trên bảng danh sách để nhiều hành động cùng lúc (tối đa 2, xem
   * SUPPLIER_TRANSACTION_NEXT_STATUSES) không kéo cao row. Mặc định 'buttons' (dàn hàng ngang có
   * label, dùng ở modal chi tiết).
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
        <div className={`flex items-center gap-1 ${className}`}>
          {nexts.map((target) => {
            const meta = ACTION_META[target];
            const Icon = meta.icon;
            return (
              <button
                key={target}
                type="button"
                aria-label={meta.label}
                title={meta.label}
                disabled={submitting !== null}
                onClick={() => handleClick(target)}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 ${ICON_BUTTON_HOVER[meta.variant]}`}
              >
                {submitting === target ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <Icon className="h-4 w-4" />
                )}
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
