'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Flag, MoreVertical, PackageCheck, XCircle, type LucideIcon } from 'lucide-react';
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

interface Props {
  transaction: SupplierTransaction;
  onDone: () => void; // gọi sau khi chuyển trạng thái thành công (để refetch)
  size?: 'sm' | 'md';
  className?: string;
  /**
   * 'menu' gộp mọi hành động chuyển trạng thái vào 1 nút kebab (⋮ 32x32) mở dropdown — dùng ở cột
   * "Thao tác" trên bảng danh sách để row không bị cao vì nhiều nút. Mặc định 'buttons' (dàn hàng
   * ngang, dùng ở modal chi tiết). Dropdown render qua Portal vào `document.body` (định vị bằng
   * `getBoundingClientRect`) để không bị vùng cuộn ngang `overflow-x-auto` của bảng cắt mất.
   */
  variant?: 'buttons' | 'menu';
}

export default function SupplierTransactionStatusActions({ transaction, onDone, size = 'sm', className = '', variant = 'buttons' }: Readonly<Props>) {
  const [pendingTarget, setPendingTarget] = useState<TargetStatus | null>(null); // đang chờ xác nhận
  const [submitting, setSubmitting] = useState<TargetStatus | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const nexts = (SUPPLIER_TRANSACTION_NEXT_STATUSES[transaction.status as SupplierTransactionStatus] ?? []) as TargetStatus[];

  useEffect(() => {
    if (!isMenuOpen) return;
    const close = () => setIsMenuOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isMenuOpen]);

  if (nexts.length === 0) return null; // COMPLETED/CANCELLED — điểm cuối, không còn hành động

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const menuWidth = 176; // w-44
      const menuHeight = nexts.length * 40 + 8;
      const flipUp = rect.bottom + menuHeight > window.innerHeight;
      setMenuPos({
        top: flipUp ? rect.top - menuHeight - 4 : rect.bottom + 4,
        left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
      });
    }
    setIsMenuOpen(true);
  };

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
    setIsMenuOpen(false);
    if (ACTION_META[target].confirm) setPendingTarget(target);
    else void runTransition(target);
  };

  return (
    <>
      {variant === 'menu' ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            aria-label="Thao tác khác"
            title="Thao tác khác"
            onClick={() => (isMenuOpen ? setIsMenuOpen(false) : openMenu())}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 ${className}`}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {isMenuOpen &&
            menuPos &&
            createPortal(
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                <div
                  className="fixed z-50 w-44 overflow-hidden rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200"
                  style={{ top: menuPos.top, left: menuPos.left }}
                >
                  {nexts.map((target) => {
                    const meta = ACTION_META[target];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={target}
                        type="button"
                        disabled={submitting !== null}
                        onClick={() => handleClick(target)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${
                          meta.variant === 'danger' ? 'text-red-600' : 'text-slate-700'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </>,
              document.body,
            )}
        </>
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
