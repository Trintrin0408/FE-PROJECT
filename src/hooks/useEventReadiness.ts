'use client';

// Hook gom dữ liệu cho "Bảng sẵn sàng vận hành" (go/no-go matrix) — trả lời câu hỏi: trong các sự
// kiện sắp diễn ra, cái nào ĐÃ đủ điều kiện chạy và cái nào còn thiếu khâu gì. Tái dùng đúng các API
// thật đã có (giống useManagerDashboard): /orders, /survey-reports, /schedule-plans — KHÔNG N+1, chỉ 3
// lời gọi danh sách rồi gom theo orderId ở client (backend chưa có endpoint tổng hợp readiness).

import { useEffect, useState } from 'react';
import { orderApiService } from '@/services/order.service';
import { surveyApiService } from '@/services/survey.service';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import { toDateInputValue } from '@/utils/formatDate';
import type { Order, OrderStatus, OrderPaymentStatus } from '@/types/order';
import type { SurveyReportListItem } from '@/types/survey';
import type { SchedulePlan } from '@/types/schedulePlan';

/** Trạng thái 1 cổng chuẩn bị: xong / còn thiếu / chưa tới lượt (không áp dụng). */
export type GateState = 'done' | 'pending' | 'na';

export type GateKey = 'deposit' | 'survey' | 'staff' | 'picked';

export interface ReadinessRow {
  orderId: string;
  orderCode: string;
  customerName: string;
  eventName?: string;
  eventType?: string;
  eventDate: string;
  location?: string;
  totalAmount: number;
  orderStatus: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  /** Số ngày còn lại tới ngày diễn ra sự kiện (âm = đã qua). */
  daysLeft: number;
  gates: Record<GateKey, GateState>;
  readyCount: number;
  totalGates: number;
}

export interface EventReadiness {
  isLoading: boolean;
  loadError: string | null;
  rows: ReadinessRow[];
  /** KPI: sự kiện sắp tới đang thiếu khâu (≤7 ngày & chưa đủ cổng). */
  atRisk: number;
  upcoming: number;
  fullyReady: number;
}

// Chỉ hiển thị đơn còn trong pipeline vận hành (đã đóng/hủy thì không cần theo dõi sẵn sàng nữa).
const ACTIVE_STATUSES: OrderStatus[] = ['NEW', 'CONFIRMED', 'IN_PROGRESS'];
const GATE_KEYS: GateKey[] = ['deposit', 'survey', 'staff', 'picked'];

function daysBetweenToday(eventDate: string): number {
  const today = new Date(`${toDateInputValue(Date.now())}T00:00:00`);
  const ev = new Date(`${toDateInputValue(eventDate)}T00:00:00`);
  return Math.round((ev.getTime() - today.getTime()) / 86_400_000);
}

export function useEventReadiness(): EventReadiness {
  const [state, setState] = useState<EventReadiness>({
    isLoading: true,
    loadError: null,
    rows: [],
    atRisk: 0,
    upcoming: 0,
    fullyReady: 0,
  });

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      orderApiService.getOrders({ limit: 100 }),
      // Giới hạn theo max của backend: /survey-reports ≤ 100, /schedule-plans ≤ 500.
      surveyApiService.getSurveyReports({ limit: 100 }).catch(() => ({ data: [] as SurveyReportListItem[] })),
      schedulePlanApiService
        .getSchedulePlans({ dateFrom: '2026-01-01', dateTo: '2027-12-31', dateMode: 'timeline', limit: 500 })
        .catch(() => ({ data: [] as SchedulePlan[] })),
    ])
      .then(([ordersRes, surveyRes, plansRes]) => {
        if (cancelled) return;

        const orders = (ordersRes?.data ?? []) as Order[];
        const surveys = ((surveyRes as { data?: SurveyReportListItem[] })?.data ?? []) as SurveyReportListItem[];
        const plans = ((plansRes as { data?: SchedulePlan[] })?.data ?? []) as SchedulePlan[];

        // Gom khảo sát theo đơn: có bản CONFIRMED = xong; có bản khác = còn chờ; không có = chưa làm.
        const surveyByOrder = new Map<string, { confirmed: boolean; any: boolean }>();
        for (const s of surveys) {
          const cur = surveyByOrder.get(s.orderId) ?? { confirmed: false, any: false };
          cur.any = true;
          if (s.status === 'CONFIRMED') cur.confirmed = true;
          surveyByOrder.set(s.orderId, cur);
        }

        // Gom phân công theo đơn: có ≥1 kế hoạch (không bị hủy) gắn ít nhất 1 nhân sự = đã phân công.
        const staffedOrders = new Set<string>();
        for (const p of plans) {
          if (!p.orderId || p.status === 'CANCELLED') continue;
          if ((p.assignees?.length ?? 0) > 0) staffedOrders.add(p.orderId);
        }

        const rows: ReadinessRow[] = orders
          .filter((o) => ACTIVE_STATUSES.includes(o.orderStatus))
          .map((o) => {
            const sv = surveyByOrder.get(o.orderId);
            const gates: Record<GateKey, GateState> = {
              deposit: o.paymentStatus === 'DEPOSITED' || o.paymentStatus === 'PAID' ? 'done' : 'pending',
              survey: sv?.confirmed ? 'done' : 'pending',
              staff: staffedOrders.has(o.orderId) ? 'done' : 'pending',
              picked: o.pickedUpAt ? 'done' : 'pending',
            };
            const readyCount = GATE_KEYS.filter((k) => gates[k] === 'done').length;
            return {
              orderId: o.orderId,
              orderCode: o.orderCode,
              customerName: o.customerName,
              eventName: o.eventName,
              eventType: o.eventType,
              eventDate: o.eventDate,
              location: o.location,
              totalAmount: o.totalAmount,
              orderStatus: o.orderStatus,
              paymentStatus: o.paymentStatus,
              daysLeft: daysBetweenToday(o.eventDate),
              gates,
              readyCount,
              totalGates: GATE_KEYS.length,
            };
          })
          .sort((a, b) => a.daysLeft - b.daysLeft);

        const upcoming = rows.filter((r) => r.daysLeft >= 0).length;
        const atRisk = rows.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 7 && r.readyCount < r.totalGates).length;
        const fullyReady = rows.filter((r) => r.readyCount === r.totalGates).length;

        setState({ isLoading: false, loadError: null, rows, atRisk, upcoming, fullyReady });
      })
      .catch((err) => {
        if (cancelled) return;
        setState((s) => ({ ...s, isLoading: false, loadError: err?.message || 'Không tải được dữ liệu sẵn sàng.' }));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
