'use client';

// Nạp 1 lần dữ liệu điều phối (đơn + kế hoạch + roster nhân sự) để các màn lịch/điều vận tính toán theo
// ngày ở client — tránh gọi lại API mỗi lần đổi ngày. Dùng cho "Điều vận theo ngày" (bảng gộp tài nguyên).

import { useEffect, useState } from 'react';
import { orderApiService } from '@/services/order.service';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import { userApiService } from '@/services/user.service';
import type { Order } from '@/types/order';
import type { SchedulePlan } from '@/types/schedulePlan';

export interface StaffLite {
  userId: string;
  fullName: string;
}

export interface ScheduleData {
  isLoading: boolean;
  loadError: string | null;
  orders: Order[];
  plans: SchedulePlan[];
  staff: StaffLite[];
}

export function useScheduleData(): ScheduleData {
  const [data, setData] = useState<ScheduleData>({ isLoading: true, loadError: null, orders: [], plans: [], staff: [] });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      orderApiService.getOrders({ limit: 100 }),
      schedulePlanApiService
        .getSchedulePlans({ dateFrom: '2026-01-01', dateTo: '2027-12-31', dateMode: 'timeline', limit: 500 })
        .catch(() => ({ data: [] as SchedulePlan[] })),
      userApiService.getUsers({ role: 'STAFF', limit: 100 }).catch(() => ({ data: [] as { userId: string; fullName: string }[] })),
    ])
      .then(([ordersRes, plansRes, staffRes]) => {
        if (cancelled) return;
        const staff = ((staffRes as { data?: { userId: string; fullName: string }[] })?.data ?? []).map((s) => ({
          userId: s.userId,
          fullName: s.fullName,
        }));
        setData({
          isLoading: false,
          loadError: null,
          orders: (ordersRes?.data ?? []) as Order[],
          plans: ((plansRes as { data?: SchedulePlan[] })?.data ?? []) as SchedulePlan[],
          staff,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setData((d) => ({ ...d, isLoading: false, loadError: err?.message || 'Không tải được dữ liệu điều vận.' }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}
