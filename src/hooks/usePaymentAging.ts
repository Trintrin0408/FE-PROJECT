'use client';

// Hook cho "Công nợ & dòng tiền theo thời gian" — trả lời: đơn nào đang treo tiền và MỨC ĐỘ GẤP theo
// ngày sự kiện (chưa thu cọc mà sắp tới ngày = rủi ro; đã qua sự kiện mà chưa quyết toán = quá hạn).
// Chỉ dùng GET /orders (total/paymentStatus/eventDate/status có sẵn trong list DTO) — KHÔNG N+1.

import { useEffect, useState } from 'react';
import { orderApiService } from '@/services/order.service';
import { toDateInputValue } from '@/utils/formatDate';
import type { Order, OrderStatus, OrderPaymentStatus } from '@/types/order';

/** Mức rủi ro công nợ, sắp xếp giảm dần độ gấp. */
export type AgingLevel = 'overdue' | 'urgent' | 'due-soon' | 'watch';

export interface AgingRow {
  orderId: string;
  orderCode: string;
  customerName: string;
  eventName?: string;
  eventDate: string;
  totalAmount: number;
  orderStatus: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  daysLeft: number; // < 0 = đã qua sự kiện
  level: AgingLevel;
  reason: string;
}

export interface PaymentAging {
  isLoading: boolean;
  loadError: string | null;
  rows: AgingRow[];
  unpaidCount: number; // chưa thu cọc
  settlementOverdue: number; // đã cọc nhưng qua sự kiện chưa quyết toán
  outstandingValue: number; // tổng giá trị đơn chưa thu đủ
}

const LEVEL_RANK: Record<AgingLevel, number> = { overdue: 0, urgent: 1, 'due-soon': 2, watch: 3 };

function daysBetweenToday(eventDate: string): number {
  const today = new Date(`${toDateInputValue(Date.now())}T00:00:00`);
  const ev = new Date(`${toDateInputValue(eventDate)}T00:00:00`);
  return Math.round((ev.getTime() - today.getTime()) / 86_400_000);
}

function classify(payment: OrderPaymentStatus, daysLeft: number): { level: AgingLevel; reason: string } {
  if (payment === 'UNPAID') {
    if (daysLeft <= 0) return { level: 'overdue', reason: 'Quá hạn — chưa thu cọc dù đã tới ngày sự kiện' };
    if (daysLeft <= 7) return { level: 'urgent', reason: `Gấp — chưa thu cọc, còn ${daysLeft} ngày` };
    if (daysLeft <= 30) return { level: 'due-soon', reason: 'Cần thu cọc (chính sách cọc trước 30 ngày)' };
    return { level: 'watch', reason: 'Chưa thu cọc' };
  }
  // DEPOSITED (đã cọc, chưa quyết toán đủ)
  if (daysLeft < 0) return { level: 'overdue', reason: `Quá hạn quyết toán — sự kiện đã qua ${-daysLeft} ngày` };
  if (daysLeft <= 3) return { level: 'due-soon', reason: 'Sắp tới hạn quyết toán cuối kỳ' };
  return { level: 'watch', reason: 'Đã cọc, chờ quyết toán sau sự kiện' };
}

export function usePaymentAging(): PaymentAging {
  const [state, setState] = useState<PaymentAging>({
    isLoading: true,
    loadError: null,
    rows: [],
    unpaidCount: 0,
    settlementOverdue: 0,
    outstandingValue: 0,
  });

  useEffect(() => {
    let cancelled = false;
    orderApiService
      .getOrders({ limit: 100 })
      .then((res) => {
        if (cancelled) return;
        const orders = (res?.data ?? []) as Order[];

        const rows: AgingRow[] = orders
          // Còn treo tiền = chưa thanh toán đủ (PAID) và đơn chưa bị hủy.
          .filter((o) => o.paymentStatus !== 'PAID' && o.orderStatus !== 'CANCELLED')
          .map((o) => {
            const daysLeft = daysBetweenToday(o.eventDate);
            const { level, reason } = classify(o.paymentStatus, daysLeft);
            return {
              orderId: o.orderId,
              orderCode: o.orderCode,
              customerName: o.customerName,
              eventName: o.eventName,
              eventDate: o.eventDate,
              totalAmount: o.totalAmount,
              orderStatus: o.orderStatus,
              paymentStatus: o.paymentStatus,
              daysLeft,
              level,
              reason,
            };
          })
          .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.daysLeft - b.daysLeft);

        setState({
          isLoading: false,
          loadError: null,
          rows,
          unpaidCount: rows.filter((r) => r.paymentStatus === 'UNPAID').length,
          settlementOverdue: rows.filter((r) => r.paymentStatus === 'DEPOSITED' && r.daysLeft < 0).length,
          outstandingValue: rows.reduce((s, r) => s + (r.totalAmount ?? 0), 0),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState((s) => ({ ...s, isLoading: false, loadError: err?.message || 'Không tải được dữ liệu công nợ.' }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
