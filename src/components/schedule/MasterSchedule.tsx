'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ClipboardList,
  GanttChartSquare,
  Loader2,
  PackageOpen,
  PackageSearch,
  Truck,
  Users,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Modal } from '@/components/ui/Modal';
import PlanDetailDrawer from '@/components/planning/PlanDetailDrawer';
import Reveal from '@/components/ui/Reveal';
import OrderTimelineChart, { TIMELINE_DAY_COUNT, toDateStr, addDaysStr } from '@/components/timeline/OrderTimelineChart';
import { orderApiService } from '@/services/order.service';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import { formatDate } from '@/utils/formatDate';
import { computeOrderLockWindow } from '@/utils/inventoryLock';
import { OrderPlanGroup, groupPlansByOrder } from '@/utils/schedulePlanGroups';
import {
  ORDER_STATUS_ORDER,
  ORDER_STATUS_STYLE,
  addDaysKey,
  buildDayLoad,
  buildStaffLanes,
  diffDaysKey,
  extractEquipmentMovements,
  orderStatusStyle,
  todayKeyVN,
  vnDateKey,
} from '@/utils/scheduleCalendar';
import type { Order } from '@/types/order';
import type { SchedulePlan } from '@/types/schedulePlan';
import EventCalendar from './master/EventCalendar';
import StaffScheduleGrid from './master/StaffScheduleGrid';
import EquipmentMovementBoard from './master/EquipmentMovementBoard';
import EquipmentReservationTimeline from './master/EquipmentReservationTimeline';
import DispatchBoard from './master/DispatchBoard';
import StaffUtilization from './master/StaffUtilization';

type ViewKey = 'events' | 'orders' | 'staff' | 'utilization' | 'equipment' | 'reservations' | 'dispatch';

const VIEWS: { key: ViewKey; label: string; icon: typeof CalendarDays }[] = [
  { key: 'events', label: 'Lịch sự kiện', icon: CalendarDays },
  { key: 'orders', label: 'Timeline đơn', icon: GanttChartSquare },
  { key: 'staff', label: 'Lịch nhân sự', icon: Users },
  { key: 'utilization', label: 'Tải nhân sự', icon: BarChart3 },
  // { key: 'equipment', label: 'Thiết bị đi/về', icon: Truck }, // Tạm ẩn theo yêu cầu
  { key: 'reservations', label: 'Giữ chỗ thiết bị', icon: PackageSearch },
  { key: 'dispatch', label: 'Điều vận ngày', icon: ClipboardList },
];

interface Props {
  /** Sinh đường dẫn tới chi tiết đơn theo vai trò (admin: /admin/orders_audit/:id, manager: /manager/orders/:id). */
  orderHref: (orderId: string) => string;
}

export default function MasterSchedule({ orderHref }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const todayKey = todayKeyVN();
  // "Hôm nay" cho timeline dùng CÙNG ngày VN với toàn trang (tránh lệch 1 ngày lúc rạng sáng do UTC).
  const todayStr = todayKey;

  const [view, setView] = useState<ViewKey>('events');
  // Tháng đang xem lưu bằng chỉ số tuyệt đối (year*12 + month0) theo giờ VN — lùi/tiến không cần setState lồng.
  const [monthIndex, setMonthIndex] = useState(() => {
    const [y, m] = todayKeyVN().split('-').map(Number);
    return y * 12 + (m - 1);
  });
  const calYear = Math.floor(monthIndex / 12);
  const calMonth = monthIndex % 12;
  const [selectedDay, setSelectedDay] = useState<string>(todayKey);
  const [dayDetailKey, setDayDetailKey] = useState<string | null>(null);
  const [timelineAnchor, setTimelineAnchor] = useState<string>(todayStr);
  const [groupDetail, setGroupDetail] = useState<OrderPlanGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Cửa sổ ngày ĐỘNG quanh hôm nay (không hardcode năm để khỏi lỗi thời): ~1 năm trước → ~1.5 năm sau.
        // limit 500 = trần backend cho /schedule-plans; 100 = trần /orders. Mỗi call cô lập lỗi để 1 nguồn
        // hỏng không đánh sập cả trang.
        const from = addDaysKey(todayKey, -365);
        const to = addDaysKey(todayKey, 550);
        const [ordersRes, plansRes] = await Promise.all([
          orderApiService.getOrders({ limit: 100 }).catch(() => null),
          schedulePlanApiService.getSchedulePlans({ dateFrom: from, dateTo: to, dateMode: 'plan', limit: 500 }).catch(() => null),
        ]);
        if (cancelled) return;
        if (!ordersRes && !plansRes) {
          setError('Không tải được dữ liệu lịch. Vui lòng thử lại.');
        } else {
          setOrders((ordersRes?.data ?? []) as Order[]);
          setPlans((plansRes?.data ?? []) as SchedulePlan[]);
        }
      } catch {
        if (!cancelled) setError('Không tải được dữ liệu lịch. Vui lòng thử lại.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter trạng thái đơn (áp cho lịch sự kiện — đã gộp cả mức bận vào view này).
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set());
  const toggleStatus = useCallback(
    (s: string) =>
      setHiddenStatuses((prev) => {
        const next = new Set(prev);
        if (next.has(s)) next.delete(s);
        else next.add(s);
        return next;
      }),
    [],
  );
  const filteredOrders = useMemo(() => orders.filter((o) => !hiddenStatuses.has(o.orderStatus)), [orders, hiddenStatuses]);

  // Dữ liệu dẫn xuất dùng chung
  const dayLoadMap = useMemo(() => buildDayLoad(filteredOrders), [filteredOrders]);
  const staffLanes = useMemo(() => buildStaffLanes(plans), [plans]);
  const movements = useMemo(() => extractEquipmentMovements(plans), [plans]);
  const groups = useMemo(() => groupPlansByOrder(plans), [plans]);
  const orderById = useMemo(() => new Map(orders.map((o) => [o.orderId, o])), [orders]);

  // Chọn ngày mặc định hợp lý cho view nhân sự/thiết bị: ngày gần hôm nay nhất có hoạt động.
  useEffect(() => {
    if (plans.length === 0) return;
    const dayKeys = Array.from(new Set(plans.map((p) => vnDateKey(p.startTime)))).sort();
    if (dayKeys.includes(todayKey)) return; // đã hợp lý
    const future = dayKeys.find((k) => k >= todayKey);
    setSelectedDay(future ?? dayKeys[dayKeys.length - 1]);
    // chỉ chạy 1 lần khi có plans
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans.length]);

  // KPI
  const kpis = useMemo(() => {
    const active = orders.filter((o) => o.orderStatus !== 'CANCELLED');
    const upcoming7 = active.filter((o) => {
      const d = diffDaysKey(todayKey, vnDateKey(o.eventDate));
      return d >= 0 && d <= 7;
    }).length;
    const inProgress = orders.filter((o) => o.orderStatus === 'IN_PROGRESS').length;
    const conflictStaff = staffLanes.filter((l) => l.conflictCount > 0).length;
    const equipmentOut = orders.filter((o) => o.pickedUpAt && o.orderStatus !== 'COMPLETED' && o.orderStatus !== 'CANCELLED').length;
    return { upcoming7, inProgress, conflictStaff, equipmentOut };
  }, [orders, staffLanes, todayKey]);

  // Timeline (Gantt) rows — tái dùng đúng logic trang Kế hoạch: khoảng thanh = cửa sổ khóa kho.
  const timelineDays = useMemo(() => Array.from({ length: TIMELINE_DAY_COUNT }, (_, i) => addDaysStr(timelineAnchor, i)), [timelineAnchor]);
  const timelineRows = useMemo(() => {
    const rangeStart = timelineDays[0];
    const rangeEnd = timelineDays[timelineDays.length - 1];
    return groups
      .map((g) => {
        const order = orderById.get(g.orderId);
        const w = computeOrderLockWindow({ eventDate: order?.eventDate ?? g.eventDate, endDate: order?.endDate ?? g.endDate }, g.rows);
        const range: [string, string] = [new Date(w.lockFrom).toISOString(), new Date(w.lockUntil ?? w.lockFrom).toISOString()];
        return { group: g, range };
      })
      .filter(({ range }) => toDateStr(new Date(range[0])) <= rangeEnd && toDateStr(new Date(range[1])) >= rangeStart)
      .sort((a, b) => a.range[0].localeCompare(b.range[0]));
  }, [groups, orderById, timelineDays]);

  const openDay = useCallback((key: string) => {
    setSelectedDay(key);
    setDayDetailKey(key);
  }, []);

  const goResourceDay = useCallback((key: string, target: ViewKey) => {
    setSelectedDay(key);
    setDayDetailKey(null);
    setView(target);
  }, []);

  const shiftDay = useCallback((delta: number) => setSelectedDay((prev) => addDaysStr(prev, delta)), []);
  const prevMonth = useCallback(() => setMonthIndex((i) => i - 1), []);
  const nextMonth = useCallback(() => setMonthIndex((i) => i + 1), []);
  const goToday = useCallback(() => {
    const [y, m] = todayKey.split('-').map(Number);
    setMonthIndex(y * 12 + (m - 1));
    setSelectedDay(todayKey);
  }, [todayKey]);

  const dayOrders = dayDetailKey ? dayLoadMap.get(dayDetailKey)?.orders ?? [] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" /> Đang tải dữ liệu lịch…
      </div>
    );
  }
  if (error) {
    return <div className="py-24 text-center text-sm text-rose-500">{error}</div>;
  }

  return (
    <div>
      {/* KPI strip */}
      <Reveal className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={CalendarDays} tone="text-blue-600" bg="bg-blue-50" value={kpis.upcoming7} label="Sự kiện trong 7 ngày tới" />
        <KpiCard icon={GanttChartSquare} tone="text-indigo-600" bg="bg-indigo-50" value={kpis.inProgress} label="Đơn đang thực hiện" />
        <KpiCard icon={AlertTriangle} tone="text-rose-600" bg="bg-rose-50" value={kpis.conflictStaff} label="Nhân sự bị trùng lịch" highlight={kpis.conflictStaff > 0} />
        <KpiCard icon={PackageOpen} tone="text-amber-600" bg="bg-amber-50" value={kpis.equipmentOut} label="Đơn có thiết bị ngoài kho" />
      </Reveal>

      {/* View switcher */}
      <div className="mt-5 flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xs">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const activeView = v.key === view;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={[
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition',
                activeView ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" />
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Filter trạng thái (chỉ cho lịch sự kiện) */}
      {view === 'events' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Lọc trạng thái:</span>
          {ORDER_STATUS_ORDER.map((s) => {
            const on = !hiddenStatuses.has(s);
            const st = ORDER_STATUS_STYLE[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${on ? st.bar : 'border-slate-200 bg-white text-slate-300'}`}
              >
                <span className={`inline-block h-2 w-2 rounded-full ${on ? st.dot : 'bg-slate-300'}`} />
                {st.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Views */}
      {view === 'events' && (
        <EventCalendar
          year={calYear}
          month0={calMonth}
          todayKey={todayKey}
          dayLoadMap={dayLoadMap}
          selectedDay={selectedDay}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          onToday={goToday}
          onSelectDay={openDay}
        />
      )}
      {view === 'orders' && (
        <OrderTimelineChart
          timelineAnchor={timelineAnchor}
          setTimelineAnchor={setTimelineAnchor}
          timelineDays={timelineDays}
          todayStr={todayStr}
          timelineRows={timelineRows}
          onSelectGroupDetail={setGroupDetail}
        />
      )}
      {view === 'staff' && (
        <StaffScheduleGrid selectedDay={selectedDay} lanes={staffLanes} todayKey={todayKey} onPrevDay={() => shiftDay(-1)} onNextDay={() => shiftDay(1)} onToday={goToday} onPickDay={setSelectedDay} />
      )}
      {view === 'utilization' && <StaffUtilization lanes={staffLanes} todayKey={todayKey} />}
      {view === 'equipment' && (
        <EquipmentMovementBoard selectedDay={selectedDay} movements={movements} onPrevDay={() => shiftDay(-1)} onNextDay={() => shiftDay(1)} onToday={goToday} onPickDay={setSelectedDay} />
      )}
      {view === 'reservations' && <EquipmentReservationTimeline todayKey={todayKey} orderHref={orderHref} />}
      {view === 'dispatch' && (
        <DispatchBoard selectedDay={selectedDay} movements={movements} orderHref={orderHref} onPrevDay={() => shiftDay(-1)} onNextDay={() => shiftDay(1)} onToday={goToday} onPickDay={setSelectedDay} />
      )}

      {/* Modal chi tiết 1 ngày (từ overview / lịch sự kiện) */}
      <Modal isOpen={dayDetailKey !== null} onClose={() => setDayDetailKey(null)} title={dayDetailKey ? `Sự kiện ngày ${formatDate(dayDetailKey)}` : ''} size="lg">
        {dayOrders.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Không có đơn nào diễn ra trong ngày này.</p>
        ) : (
          <div className="space-y-2">
            {dayOrders.map((o) => {
              const st = orderStatusStyle(o.orderStatus);
              return (
                <Link
                  key={o.orderId}
                  href={orderHref(o.orderId)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 hover:border-blue-300 hover:bg-blue-50/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">
                      <span className="font-mono text-blue-600">{o.orderCode}</span> · {o.eventName ?? o.customerName}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">{o.customerName} · {o.location}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${st.bar}`}>{st.label}</span>
                </Link>
              );
            })}
          </div>
        )}
        {dayDetailKey && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={() => goResourceDay(dayDetailKey, 'staff')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <Users className="h-3.5 w-3.5" /> Lịch nhân sự ngày này
            </button>
            {/* <button type="button" onClick={() => goResourceDay(dayDetailKey, 'equipment')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <Truck className="h-3.5 w-3.5" /> Thiết bị đi/về ngày này
            </button> */}
          </div>
        )}
      </Modal>

      {/* Chi tiết kế hoạch đơn khi bấm 1 đơn ở Timeline — dạng SIDEBAR trượt từ phải (như trang Lịch
          điều phối), thay cho modal cũ. */}
      <AnimatePresence>
        {groupDetail && (
          <PlanDetailDrawer
            group={groups.find((g) => g.orderId === groupDetail.orderId) ?? groupDetail}
            onClose={() => setGroupDetail(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  tone,
  bg,
  value,
  label,
  highlight,
}: {
  icon: typeof CalendarDays;
  tone: string;
  bg: string;
  value: number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-xs ${highlight ? 'border-rose-200' : 'border-slate-200'}`}>
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}>
        <Icon className={`h-5 w-5 ${tone}`} />
      </div>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
    </div>
  );
}
