'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AlertTriangle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Edit, Eye, FileText, Loader2, MapPin, Plus, Search, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import type { PaginationState } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import PlanDetailDrawer from '@/components/planning/PlanDetailDrawer';
import PlanFormDrawer, { PlanOrderOption } from '@/components/planning/PlanFormDrawer';
import Reveal from '@/components/ui/Reveal';
import OrderTimelineChart, { TIMELINE_DAY_COUNT, toDateStr, addDaysStr } from '@/components/timeline/OrderTimelineChart';
import { formatDate, formatTime } from '@/utils/formatDate';
import { daysUntil, getEventUrgency } from '@/utils/eventDate';
import { computeOrderLockWindow } from '@/utils/inventoryLock';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import { orderApiService } from '@/services/order.service';
import type { SchedulePlan } from '@/types/schedulePlan';
import type { Order } from '@/types/order';
import {
  OrderPlanGroup,
  SCHEDULE_STATUS_BADGE,
  SCHEDULE_STATUS_LABEL,
  distinctAssigneeCount,
  getEarliestRowLead,
  getGroupMinMaxRange,
  getGroupStatusInfo,
  groupPlansByOrder,
} from '@/utils/schedulePlanGroups';

// Kết nối backend thật (2026-07-21) — xem docs/kehoachvaphancong_api.md, docs/lichtimeline_api.md,
// docs/chitietkehoach_api.md (mirror 1:1 với src/app/admin/coordination/planning/page.tsx). Phát
// hiện quan trọng nhất: DB thật KHÔNG lưu "1 kế hoạch" như 1 bản ghi — mỗi dòng `schedule_plans` là
// 1 order + 1 loại việc (task_id) riêng; 1 "kế hoạch" hiển thị trên UI = group nhiều dòng cùng
// order_id (xử lý ở src/utils/schedulePlanGroups.ts). Đã bỏ hẳn luồng "đơn đặt ảo từ báo giá"
// (?quotationId=, chưa có route nào trỏ vào đây kèm quotationId) — quyết định lập lịch khảo sát khi
// báo giá chưa có đơn thật vẫn CHƯA implement được, chờ Backend đổi schema (mục 8.1/12 tài liệu trên).
// Helper functions (addDaysStr, toDateStr, v.v) đã được dời sang OrderTimelineChart
const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function ManagerPlanningPage() {
  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'timeline' | 'list'>('calendar');

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
  // Theo yêu cầu người dùng (2026-07-24): KHÔNG loại đơn đã có kế hoạch khỏi danh sách chọn nữa — 1 đơn
  // có thể tạo thêm nhiều kế hoạch/hoạt động khác nhau qua "Tạo kế hoạch mới", không bắt buộc phải dùng
  // "Chỉnh sửa kế hoạch" cho đơn đã có sẵn 1 kế hoạch. Chỉ còn loại theo trạng thái đơn (đã xong/đã hủy).
  const selectableOrders: PlanOrderOption[] = useMemo(
    () =>
      orders
        .filter((o) => o.orderStatus !== 'COMPLETED' && o.orderStatus !== 'CANCELLED')
        .map((o) => ({
          orderId: o.orderId,
          orderCode: o.orderCode,
          customerName: o.customerName ?? '',
          eventName: o.eventName ?? '',
          eventDate: o.eventDate,
          location: o.location ?? '',
        })),
    [orders],
  );

  const todayStr = useMemo(() => toDateStr(new Date()), []);

  const approachingGroups = useMemo(
    () => groups.filter((g) => getEventUrgency(daysUntil(g.eventDate, todayStr)) !== 'none'),
    [groups, todayStr],
  );
  const approachingUrgentCount = approachingGroups.filter((g) => getEventUrgency(daysUntil(g.eventDate, todayStr)) === 'urgent').length;
  const approachingSoonCount = approachingGroups.length - approachingUrgentCount;

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CHUAN_BI' | 'DA_CHOT' | 'DANG_THUC_HIEN' | 'HOAN_THANH' | 'DA_HUY'>('ALL');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [timelineAnchor, setTimelineAnchor] = useState(todayStr);
  const timelineDays = useMemo(() => Array.from({ length: TIMELINE_DAY_COUNT }, (_, i) => addDaysStr(timelineAnchor, i)), [timelineAnchor]);
  // Timeline hiện theo đúng khung "khóa kho" thực tế (computeOrderLockWindow — chỉ tính lịch trình
  // SETUP/COLLECT ±6h đệm, khớp logic Backend getLockedQuantityByDate), KHÔNG dùng MIN/MAX toàn bộ dòng
  // lịch trình (getGroupMinMaxRange) nữa — trước đây thanh timeline bị kéo dài lố tới tận ngày "Khảo sát
  // hiện trường" (không giữ thiết bị) thay vì đúng khoảng đơn đang khóa kho (yêu cầu người dùng 2026-08-06).
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
      .map((g) => ({ group: g, range: lockWindowRange(g) }))
      .filter(({ range }) => toDateStr(new Date(range[0])) <= rangeEnd && toDateStr(new Date(range[1])) >= rangeStart)
      .sort((a, b) => a.range[0].localeCompare(b.range[0]));
  }, [groups, timelineDays, lockWindowRange]);

  const [selectedGroupDetail, setSelectedGroupDetail] = useState<OrderPlanGroup | null>(null);
  // Mã kế hoạch (plan_code) của thẻ công việc cụ thể vừa nhấn — để Drawer chi tiết ưu tiên hiển thị
  // đúng công việc đó thay vì chỉ hiện chung theo mã đơn (theo yêu cầu người dùng 2026-07-29).
  const [focusPlanId, setFocusPlanId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<OrderPlanGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<OrderPlanGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const statusMatch = (g: OrderPlanGroup) => {
    if (statusFilter === 'ALL') return true;
    const label = getGroupStatusInfo(g.rows).label;
    const map: Record<string, string> = {
      CHUAN_BI: 'Chuẩn bị',
      DA_CHOT: 'Đã chốt',
      DANG_THUC_HIEN: 'Đang thực hiện',
      HOAN_THANH: 'Hoàn thành',
      DA_HUY: 'Đã hủy',
    };
    return label === map[statusFilter];
  };

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (!statusMatch(g)) return false;
      if (!term) return true;
      return (
        g.orderCode.toLowerCase().includes(term) ||
        g.customerName.toLowerCase().includes(term) ||
        g.eventName.toLowerCase().includes(term)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / limit));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredGroups.slice((safePage - 1) * limit, safePage * limit);
  const paginationState: PaginationState = { currentPage: safePage, totalPages, totalItems: filteredGroups.length, limit };

  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();
  const leadingOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const calendarCells: (number | null)[] = [...Array(leadingOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const handlePrevMonth = () => {
    setCalendarMonth((prev) => {
      if (prev === 0) {
        setCalendarYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setCalendarMonth((prev) => {
      if (prev === 11) {
        setCalendarYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const handleGoToToday = () => {
    const now = new Date();
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth());
    setSelectedDate(toDateStr(now));
  };

  // Cả lịch tháng lẫn "Lịch ngày" đều phải xem theo TỪNG công việc (schedule-plan row) có thật — mã đơn
  // chỉ là thông tin đính kèm — theo yêu cầu người dùng (2026-07-28/29). KHÔNG dùng orders.event_date
  // để suy ra có việc ngày đó nữa: 1 đơn có eventDate trùng ngày X nhưng chưa có schedule_plan row nào
  // bắt đầu đúng ngày X (VD việc bắt đầu tối hôm trước, kéo dài qua đêm) thì KHÔNG tính là có việc ngày X.
  const getDayRows = (dateStr: string): { group: OrderPlanGroup; row: SchedulePlan }[] =>
    groups.flatMap((g) => g.rows.filter((r) => toDateStr(new Date(r.startTime)) === dateStr).map((row) => ({ group: g, row })));

  const selectedDayItems = [...getDayRows(selectedDate)].sort((a, b) => a.row.startTime.localeCompare(b.row.startTime));

  const openCreateForm = () => {
    setEditingGroup(null);
    setIsFormOpen(true);
  };

  const openEditForm = (group: OrderPlanGroup) => {
    setEditingGroup(group);
    setIsFormOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingGroup) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      for (const row of deletingGroup.rows) {
        if (row.status === 'IN_PROGRESS' || row.status === 'COMPLETED') {
          throw new Error(`Không thể hủy: hoạt động "${row.taskName ?? row.taskId}" đã ${row.status === 'IN_PROGRESS' ? 'đang thực hiện' : 'hoàn thành'}.`);
        }
      }
      for (const row of deletingGroup.rows) {
        if (row.status !== 'CANCELLED') {
          await schedulePlanApiService.updateSchedulePlanStatus(row.planId, { status: 'CANCELLED' });
        }
      }
      await reload();
      setDeletingGroup(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Có lỗi khi hủy kế hoạch.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && plans.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center p-6 text-sm text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải kế hoạch điều phối...
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 border-b border-slate-150 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Kế hoạch và phân công</h1>
            <p className="mt-0.5 text-xs text-slate-500">Theo dõi kế hoạch thi công, lắp đặt và thu hồi theo ngày</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex self-start rounded-xl border border-slate-200/50 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Lịch điều phối
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'timeline' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              Lịch timeline
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Danh sách kế hoạch
            </button>
          </div>

          <Button onClick={openCreateForm}>
            <Plus className="h-4 w-4" />
            Tạo kế hoạch mới
          </Button>
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

      {activeTab === 'list' && (
        <Reveal className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm kiếm mã đơn, khách hàng, tên sự kiện..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-4 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="CHUAN_BI">Chuẩn bị</option>
              <option value="DA_CHOT">Đã chốt</option>
              <option value="DANG_THUC_HIEN">Đang thực hiện</option>
              <option value="HOAN_THANH">Hoàn thành</option>
              <option value="DA_HUY">Đã hủy</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setStatusFilter('ALL');
              }}
              className="rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50"
            >
              Đặt lại
            </button>
          </div>
        </Reveal>
      )}

      {activeTab === 'calendar' && (
        <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <Reveal className="space-y-5 lg:col-span-7 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-sm font-extrabold tracking-tight text-slate-800">
                Lịch tháng {calendarMonth + 1}/{calendarYear}
              </h3>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={handlePrevMonth} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Tháng trước">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={handleGoToToday} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  Hôm nay
                </button>
                <button type="button" onClick={handleNextMonth} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Tháng sau">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px]">
              {WEEKDAY_LABELS.map((day) => (
                <div key={day} className="rounded-lg bg-slate-50/50 py-2.5 font-bold text-slate-400">
                  {day}
                </div>
              ))}
              {calendarCells.map((dayNum, cellIdx) => {
                if (dayNum === null) return <div key={`empty-${cellIdx}`} className="aspect-square rounded-xl border border-slate-100/30 bg-slate-50/10" />;

                const dayString = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const rowsOnDay = getDayRows(dayString);
                const isSelected = selectedDate === dayString;

                return (
                  <div
                    key={dayString}
                    onClick={() => setSelectedDate(dayString)}
                    className={`relative flex aspect-square cursor-pointer flex-col justify-between rounded-xl border p-1.5 text-left transition-all hover:border-blue-400 hover:shadow-xs ${
                      isSelected ? 'border-2 border-blue-600 bg-blue-50/20 ring-1 ring-blue-300' : 'border-slate-100 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold ${isSelected ? 'rounded-md bg-blue-100/80 px-1.5 py-0.5 text-blue-700' : 'text-slate-700'}`}>{dayNum}</span>
                      {rowsOnDay.length > 0 && !isSelected && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                    </div>
                    <div className="mt-1 space-y-1 overflow-hidden">
                      {rowsOnDay.slice(0, 2).map(({ group: g, row: r }) => {
                        return (
                          <div
                            key={r.planId}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(dayString);
                              setFocusPlanId(r.planId);
                              setSelectedGroupDetail(g);
                            }}
                            title={`${r.taskName ?? r.planCode} - Đơn ${g.orderCode} @ ${r.location || g.location}`}
                            className={`truncate rounded-md px-1 py-0.5 text-[9px] font-bold leading-tight ${SCHEDULE_STATUS_BADGE[r.status]}`}
                          >
                            {r.planCode}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-start gap-4 border-t border-slate-100 pt-4 text-[10px] font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Đang thực hiện
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Đã chốt
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Chuẩn bị
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Hoàn thành
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.05} className="flex min-h-[500px] flex-col space-y-4 lg:col-span-5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
                  <CalendarIcon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-extrabold tracking-tight text-slate-800">Lịch ngày {formatDate(selectedDate)}</h3>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">{selectedDayItems.length} công việc</span>
            </div>

            <div className="max-h-[580px] flex-1 space-y-3.5 overflow-y-auto pr-1">
              {selectedDayItems.length === 0 ? (
                <div className="my-auto flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/30 p-8 py-16 text-center">
                  <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">
                    <CalendarIcon className="h-6 w-6" />
                  </div>
                  <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-700">Chưa có lịch trình</h4>
                  <p className="max-w-[220px] text-[11px] leading-relaxed text-slate-400">Chưa có kế hoạch thi công, lắp đặt hoặc trang trí nào vào ngày này.</p>
                </div>
              ) : (
                selectedDayItems.map(({ group: g, row: r }) => {
                  const start = formatTime(r.startTime);
                  const end = r.endTime ? formatTime(r.endTime) : '—';
                  const lead = getEarliestRowLead([r]);
                  const staffCount = distinctAssigneeCount([r]);
                  const statusLabel = SCHEDULE_STATUS_LABEL[r.status];
                  const statusBadgeClass = SCHEDULE_STATUS_BADGE[r.status];
                  return (
                    <div
                      key={r.planId}
                      onClick={() => {
                        setFocusPlanId(r.planId);
                        setSelectedGroupDetail(g);
                      }}
                      className="group relative flex cursor-pointer flex-col items-start gap-4 rounded-2xl border border-slate-150 p-4 shadow-2xs transition-all hover:border-blue-400 hover:shadow-xs md:flex-row"
                    >
                      <div className="flex min-w-[70px] flex-col items-start justify-center border-b border-slate-100 pb-2 md:border-b-0 md:border-r md:pb-0 md:pr-4">
                        <span className="text-xs font-bold text-blue-600">{start}</span>
                        <span className="my-0.5 text-[9px] font-bold text-slate-400">đến</span>
                        <span className="text-xs font-bold text-blue-600">{end}</span>
                      </div>
                      <div className="w-full flex-1 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-extrabold text-blue-700">
                            {r.planCode}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass}`}>{statusLabel}</span>
                        </div>
                        <h4 className="text-xs font-bold leading-snug text-slate-900 transition-colors group-hover:text-blue-600">
                          {r.taskName ?? g.eventName}
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Thuộc đơn <span className="font-mono font-semibold text-slate-500">{g.orderCode}</span> - {g.eventName}
                        </p>
                        <div className="space-y-1.5 text-[10px] text-slate-500">
                          <p className="flex items-center gap-1.5" title={r.location || g.location}>
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                            <span className="truncate">{r.location || g.location}</span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                            <span className="truncate font-medium text-slate-600">
                              Chỉ huy: <strong className="font-semibold text-slate-800">{lead ?? 'Chưa gán'}</strong> ({staffCount} nhân sự)
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <p className="pt-2 text-center text-[10px] italic text-slate-400">Nhấp vào thẻ sự kiện trong lịch hoặc danh sách để xem chi tiết & phân công công việc.</p>
          </Reveal>
        </div>
      )}

      {activeTab === 'timeline' && (
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
      )}

      {activeTab === 'list' && (
        <Reveal className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3.5">Mã đơn đặt</th>
                  <th className="px-4 py-3.5">Mã kế hoạch</th>
                  <th className="px-4 py-3.5">Khách hàng / Sự kiện</th>
                  <th className="px-4 py-3.5">Ngày thi công</th>
                  <th className="px-4 py-3.5">Địa điểm</th>
                  <th className="px-4 py-3.5">Số công việc</th>
                  <th className="px-4 py-3.5">Nhân sự</th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  <th className="px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {pageRows.length > 0 ? (
                  pageRows.map((g) => {
                    const info = getGroupStatusInfo(g.rows);
                    const [rangeStart, rangeEnd] = getGroupMinMaxRange(g);
                    return (
                      <tr key={g.orderId} className="transition-colors hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <span className="rounded bg-slate-100 px-2 py-1 font-mono font-medium text-slate-800">{g.orderCode}</span>
                        </td>
                        <td className="max-w-[220px] px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {g.rows.slice(0, 3).map((r) => (
                              <span
                                key={r.planId}
                                title={r.planCode}
                                className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700"
                              >
                                {r.planCode}
                              </span>
                            ))}
                            {g.rows.length > 3 && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">+{g.rows.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{g.customerName}</p>
                          <p className="mt-0.5 text-[10px] text-slate-400">{g.eventName}</p>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-600">
                          {formatDate(rangeStart)} - {formatDate(rangeEnd)}
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-slate-500" title={g.location}>
                          {g.location}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-700">{g.rows.length} việc</td>
                        <td className="px-4 py-3 text-slate-600">{distinctAssigneeCount(g.rows)} người</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${info.badgeClass}`}>{info.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setFocusPlanId(null);
                                setSelectedGroupDetail(g);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Xem
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditForm(g)}
                              title="Chỉnh sửa kế hoạch"
                              className="rounded-lg border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingGroup(g)}
                              title="Hủy kế hoạch"
                              className="rounded-lg border border-slate-200 p-1 text-slate-400 hover:bg-slate-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <Clock className="mx-auto h-6 w-6 text-slate-300" />
                      <p className="mt-2 text-sm font-medium text-slate-500">Không tìm thấy kế hoạch điều phối nào</p>
                      <p className="text-xs text-slate-400">Thử thay đổi bộ lọc hoặc thêm mới kế hoạch.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination pagination={paginationState} onPageChange={setPage} />
        </Reveal>
      )}

      <AnimatePresence>
        {selectedGroupDetail && (
          <PlanDetailDrawer
            group={groupByOrderId.get(selectedGroupDetail.orderId) ?? selectedGroupDetail}
            focusPlanId={focusPlanId}
            onClose={() => {
              setSelectedGroupDetail(null);
              setFocusPlanId(null);
            }}
            onEdit={(group) => openEditForm(group)}
          />
        )}
      </AnimatePresence>

      {isFormOpen && (
        <PlanFormDrawer
          isOpen={isFormOpen}
          editingGroup={editingGroup ? (groupByOrderId.get(editingGroup.orderId) ?? editingGroup) : null}
          selectableOrders={selectableOrders}
          onClose={() => {
            setIsFormOpen(false);
            setEditingGroup(null);
          }}
          onSaved={reload}
        />
      )}

      <Modal
        isOpen={Boolean(deletingGroup)}
        onClose={() => {
          setDeletingGroup(null);
          setDeleteError(null);
        }}
        title="Hủy kế hoạch điều phối"
        subtitle={deletingGroup ? `Bạn có chắc muốn hủy toàn bộ kế hoạch của đơn "${deletingGroup.orderCode}"? Hành động này không thể hoàn tác.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingGroup(null)} disabled={deleting}>
              Hủy bỏ
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Xác nhận hủy kế hoạch
            </Button>
          </>
        }
      >
        {deleteError && <p className="text-xs text-rose-600">{deleteError}</p>}
      </Modal>
    </div>
  );
}
