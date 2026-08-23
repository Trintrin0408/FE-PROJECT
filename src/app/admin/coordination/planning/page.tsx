'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AlertTriangle, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import PlanDetailDrawer from '@/components/planning/PlanDetailDrawer';
import OrderTimelineChart, { TIMELINE_DAY_COUNT, toDateStr, addDaysStr } from '@/components/timeline/OrderTimelineChart';
import { daysUntil, getEventUrgency } from '@/utils/eventDate';
import { computeOrderLockWindow } from '@/utils/inventoryLock';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import { orderApiService } from '@/services/order.service';
import type { SchedulePlan } from '@/types/schedulePlan';
import type { Order } from '@/types/order';
import { OrderPlanGroup, getCustomerColorClass, groupPlansByOrder } from '@/utils/schedulePlanGroups';

export default function AdminPlanningPage() {
  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [plansRes, ordersRes] = await Promise.all([
        schedulePlanApiService.getSchedulePlans(),
        orderApiService.getOrders({ limit: 100 }),
      ]);
      setPlans(plansRes.data ?? []);
      setOrders(ordersRes.data ?? []);
    } catch {
      setLoadError('Không tải được dữ liệu kế hoạch từ máy chủ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const groups = useMemo(() => groupPlansByOrder(plans), [plans]);
  const groupByOrderId = useMemo(() => new Map(groups.map((g) => [g.orderId, g])), [groups]);
  const orderByOrderId = useMemo(() => new Map(orders.map((o) => [o.orderId, o])), [orders]);

  const todayStr = useMemo(() => toDateStr(new Date()), []);

  const approachingGroups = useMemo(
    () => groups.filter((g) => getEventUrgency(daysUntil(g.eventDate, todayStr)) !== 'none'),
    [groups, todayStr],
  );
  const approachingUrgentCount = approachingGroups.filter((g) => getEventUrgency(daysUntil(g.eventDate, todayStr)) === 'urgent').length;
  const approachingSoonCount = approachingGroups.length - approachingUrgentCount;

  const [timelineAnchor, setTimelineAnchor] = useState(todayStr);
  const timelineDays = useMemo(() => Array.from({ length: TIMELINE_DAY_COUNT }, (_, i) => addDaysStr(timelineAnchor, i)), [timelineAnchor]);
  // Timeline hiện theo đúng khung "khóa kho" thực tế (computeOrderLockWindow — chỉ tính lịch trình
  // SETUP/COLLECT ±6h đệm, khớp logic Backend getLockedQuantityByDate), KHÔNG dùng MIN/MAX toàn bộ dòng
  // lịch trình nữa — mirror lại đúng fix đã áp dụng ở manager/schedule/plans/page.tsx.
  const lockWindowRange = useCallback(
    (group: OrderPlanGroup): [string, string] => {
      const order = orderByOrderId.get(group.orderId);
      const window = computeOrderLockWindow({ eventDate: order?.eventDate ?? group.eventDate, endDate: order?.endDate }, group.rows);
      return [new Date(window.lockFrom).toISOString(), new Date(window.lockUntil ?? window.lockFrom).toISOString()];
    },
    [orderByOrderId],
  );
  const timelineRows = useMemo(() => {
    const rangeStart = timelineDays[0];
    const rangeEnd = timelineDays.at(-1) as string;
    return groups
      .map((g) => {
        const order = orderByOrderId.get(g.orderId);
        const customerColorClass = getCustomerColorClass(order?.customerId ?? g.orderId);
        return { group: g, range: lockWindowRange(g), customerColorClass };
      })
      .filter(({ range }) => toDateStr(new Date(range[0])) <= rangeEnd && toDateStr(new Date(range[1])) >= rangeStart)
      .sort((a, b) => a.range[0].localeCompare(b.range[0]));
  }, [groups, timelineDays, lockWindowRange, orderByOrderId]);

  const [selectedGroupDetail, setSelectedGroupDetail] = useState<OrderPlanGroup | null>(null);
  const [focusPlanId, setFocusPlanId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center p-6 text-sm text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải kế hoạch điều phối...
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Lịch điều phối</h1>
            <p className="mt-0.5 text-xs text-slate-500">Theo dõi tiến độ thi công, lắp đặt và thu hồi thiết bị</p>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      {approachingGroups.length > 0 && (
        <div
          className={`mt-4 flex items-start gap-2.5 rounded-xl border p-3.5 text-xs ${
            approachingUrgentCount > 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Có <strong>{approachingGroups.length}</strong> kế hoạch có mốc thời gian (tổ chức/khảo sát/lắp đặt/thu hồi) sắp diễn ra trong 7 ngày tới
            {approachingUrgentCount > 0 && (
              <>
                {' '}
                - <strong>{approachingUrgentCount} khẩn cấp</strong> (còn ≤3 ngày)
              </>
            )}
            {approachingSoonCount > 0 && <>, {approachingSoonCount} sắp tới (4-7 ngày)</>}.
          </p>
        </div>
      )}

      <div className="mt-6">
        <OrderTimelineChart
          timelineAnchor={timelineAnchor}
          setTimelineAnchor={setTimelineAnchor}
          timelineDays={timelineDays}
          todayStr={todayStr}
          timelineRows={timelineRows}
          onSelectGroupDetail={(group) => {
            setFocusPlanId(null);
            setSelectedGroupDetail(group);
          }}
        />
      </div>

      <AnimatePresence>
        {selectedGroupDetail && (
          <PlanDetailDrawer
            group={groupByOrderId.get(selectedGroupDetail.orderId) ?? selectedGroupDetail}
            focusPlanId={focusPlanId}
            onClose={() => {
              setSelectedGroupDetail(null);
              setFocusPlanId(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
