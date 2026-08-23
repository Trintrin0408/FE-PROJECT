'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity as ActivityIcon, Calendar, CheckCircle2, Clock, Edit, MapPin, Truck, Wrench, X } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { SearchInput } from '@/components/ui/SearchInput';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import { formatDate } from '@/utils/formatDate';
import { SchedulePlan, TASK_STATUS_META, getAdminSchedulePlans, getPlanStatusInfo } from '@/mocks/db/schedulePlans';

// Trang thuần giao diện — chưa có màn hình admin/coordination/progress tương ứng để mirror (route đó
// bên Admin vẫn "đang phát triển"). Tái dùng đúng dữ liệu Kế hoạch & phân công (activities/tasks trong
// src/mocks/adminSchedulePlansMock.ts) nhưng nhìn theo góc độ "tiến độ vận chuyển & thi công" của từng
// đơn thay vì quản lý kế hoạch — đáp ứng checklist "Vận hành hiện trường > Theo dõi vận chuyển, thi công".
//
// Trang này CHƯA thuộc phạm vi kết nối backend đợt này (không có doc docs/*_api.md riêng, không nằm
// trong 3 tài liệu đã kết nối cho "Kế hoạch và phân công"/"Lịch timeline"/"Chi tiết kế hoạch" — 3 tài
// liệu đó chỉ phân tích /manager/schedule/plans + /admin/coordination/planning). Giữ nguyên dữ liệu
// mock cũ; PlanDetailDrawer dùng chung đã đổi sang nhận dữ liệu thật (OrderPlanGroup) cho 2 trang kia
// nên không dùng lại được ở đây — thay bằng panel xem nhanh cục bộ, giữ đúng nội dung/luồng cũ.

type StageStatus = 'DONE' | 'IN_PROGRESS' | 'UPCOMING';

const STAGE_META: Record<StageStatus, { label: string; badgeClass: string }> = {
  DONE: { label: 'Hoàn thành', badgeClass: 'bg-emerald-100 text-emerald-700' },
  IN_PROGRESS: { label: 'Đang diễn ra', badgeClass: 'bg-blue-100 text-blue-700' },
  UPCOMING: { label: 'Sắp tới', badgeClass: 'bg-slate-100 text-slate-500' },
};

function stageStatusOf(activityDate: string | undefined, todayStr: string): StageStatus {
  if (!activityDate) return 'UPCOMING';
  if (activityDate < todayStr) return 'DONE';
  if (activityDate === todayStr) return 'IN_PROGRESS';
  return 'UPCOMING';
}

export default function ManagerFieldProgressPage() {
  const router = useRouter();
  const [plans] = useState<SchedulePlan[]>(() => getAdminSchedulePlans().filter((p) => p.status === 'CONFIRMED'));
  const [search, setSearch] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<SchedulePlan | null>(null);

  const [todayStr] = useState(() => new Date().toISOString().slice(0, 10));

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return plans;
    return plans.filter((p) => p.orderId.toLowerCase().includes(term) || p.customerName.toLowerCase().includes(term) || p.eventName.toLowerCase().includes(term));
  }, [plans, search]);

  const transportDoneCount = plans.filter((p) => stageStatusOf(p.activities.find((a) => a.type === 'Lắp đặt')?.date, todayStr) === 'DONE').length;
  const constructionDoneCount = plans.filter((p) => p.tasks.length > 0 && p.tasks.every((t) => t.status === 'COMPLETED')).length;
  const collectionDoneCount = plans.filter((p) => stageStatusOf(p.activities.find((a) => a.type === 'Thu hồi')?.date, todayStr) === 'DONE').length;

  const kpis: KpiCardItem[] = [
    { label: 'Đơn đang thi công', value: plans.length, icon: Wrench, iconColor: 'blue' },
    { label: 'Đã vận chuyển lắp đặt', value: transportDoneCount, icon: Truck, iconColor: 'amber' },
    { label: 'Thi công hoàn tất', value: constructionDoneCount, icon: CheckCircle2, iconColor: 'green' },
    { label: 'Đã thu hồi', value: collectionDoneCount, icon: Clock, iconColor: 'pink' },
  ];

  const columns: TableColumn<SchedulePlan>[] = [
    {
      key: 'order',
      label: 'Đơn đặt cưới',
      render: (p) => (
        <div>
          <Link href={`/manager/orders/${p.orderId}`} className="font-semibold text-blue-600 hover:underline">
            {p.orderId}
          </Link>
          <p className="text-xs text-slate-400">{p.customerName}</p>
        </div>
      ),
    },
    { key: 'eventDate', label: 'Ngày sự kiện', render: (p) => formatDate(p.eventDate) },
    {
      key: 'location',
      label: 'Địa điểm',
      render: (p) => (
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          {p.location}
        </p>
      ),
    },
    {
      key: 'transport',
      label: 'Vận chuyển & lắp đặt',
      render: (p) => {
        const stage = stageStatusOf(p.activities.find((a) => a.type === 'Lắp đặt')?.date, todayStr);
        return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STAGE_META[stage].badgeClass}`}>{STAGE_META[stage].label}</span>;
      },
    },
    {
      key: 'construction',
      label: 'Thi công kỹ thuật',
      render: (p) => {
        const total = p.tasks.length;
        const done = p.tasks.filter((t) => t.status === 'COMPLETED').length;
        if (total === 0) return <span className="text-xs text-slate-300">Chưa có công việc</span>;
        const percent = (done / total) * 100;
        return (
          <div className="min-w-[120px]">
            <p className="text-[11px] font-semibold text-slate-600">
              {done}/{total} việc
            </p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className={`h-1.5 rounded-full ${percent >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: 'collection',
      label: 'Thu hồi sau tiệc',
      render: (p) => {
        const stage = stageStatusOf(p.activities.find((a) => a.type === 'Thu hồi')?.date, todayStr);
        return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STAGE_META[stage].badgeClass}`}>{STAGE_META[stage].label}</span>;
      },
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (p) => (
        <button type="button" onClick={() => setSelectedPlan(p)} className="text-xs font-semibold text-blue-600 hover:underline">
          Xem chi tiết
        </button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Vận chuyển &amp; thi công"
        icon={<Truck className="h-6 w-6 text-blue-600" />}
        description="Theo dõi tiến độ vận chuyển/lắp đặt, thi công kỹ thuật và thu hồi của từng đơn đang thực hiện."
      />

      <div className="mt-6">
        <DashboardStats items={kpis} />
      </div>

      <FilterBar>
        <SearchInput width="grow" className="max-w-sm" value={search} onChange={setSearch} placeholder="Tìm theo mã đơn, khách hàng, tên lễ cưới..." />

        <div className="mt-4 overflow-x-auto">
          <Table columns={columns} rows={filtered} rowKey={(row) => row.id} />
        </div>
      </FilterBar>

      <AnimatePresence>
        {selectedPlan && (
          <LegacyPlanQuickView
            plan={selectedPlan}
            onClose={() => setSelectedPlan(null)}
            onEdit={() => {
              setSelectedPlan(null);
              router.push('/manager/schedule/plans');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Panel xem nhanh cục bộ cho trang này — giữ nguyên nội dung/luồng của PlanDetailDrawer bản mock cũ
 * (activities/tasks/staffList), vì component dùng chung PlanDetailDrawer đã đổi sang nhận dữ liệu
 * thật (OrderPlanGroup) cho 2 màn đã kết nối backend, không còn tương thích shape mock ở trang này. */
function LegacyPlanQuickView({ plan, onClose, onEdit }: Readonly<{ plan: SchedulePlan; onClose: () => void; onEdit: () => void }>) {
  const statusInfo = getPlanStatusInfo(plan);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Chi tiết kế hoạch vận hành</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusInfo.badgeClass}`}>{statusInfo.label}</span>
            </div>
            <h3 className="mt-1 text-base font-bold text-slate-900">{plan.id}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition-all hover:bg-slate-200/50 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between">
              <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-bold text-white">{plan.orderId}</span>
              <span className="text-[11px] font-medium text-slate-500">Người lập: {plan.manager}</span>
            </div>
            <h4 className="text-sm font-bold text-slate-900">{plan.eventName}</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <p className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-slate-400" />
                {formatDate(plan.eventDate)}
              </p>
              <p className="flex items-center gap-1">
                <MapPin className="h-4 w-4 text-slate-400" />
                {plan.location}
              </p>
            </div>
            {plan.notes && <p className="rounded-lg bg-white p-2.5 text-xs italic text-slate-500">{plan.notes}</p>}
          </div>

          <div className="space-y-3">
            <h4 className="border-l-2 border-blue-500 pl-2 text-xs font-bold uppercase tracking-wider text-slate-900">Các hoạt động chính</h4>
            <div className="space-y-2">
              {plan.activities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="rounded-lg bg-slate-50 p-2 text-slate-600">
                    <ActivityIcon className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{act.type}</span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {act.startTime} - {act.endTime}
                      </span>
                    </div>
                    <p className="leading-relaxed text-slate-500">{act.notes}</p>
                    <p className="flex items-center gap-1 text-[10px] text-slate-400">
                      <MapPin className="h-3.5 w-3.5" />
                      {act.location}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="border-l-2 border-blue-500 pl-2 text-xs font-bold uppercase tracking-wider text-slate-900">
              Danh sách công việc & phân công ({plan.tasks.length})
            </h4>
            {plan.tasks.length > 0 ? (
              <div className="space-y-3">
                {plan.tasks.map((task) => (
                  <div key={task.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="line-clamp-1 text-xs font-bold text-slate-800">{task.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TASK_STATUS_META[task.status].badgeClass}`}>
                        {TASK_STATUS_META[task.status].label}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{task.requirements}</p>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                      <span>
                        Phụ trách: <strong className="text-slate-800">{task.assignee}</strong>
                      </span>
                      <span>
                        Đồng hành: <strong className="text-slate-800">{task.team.join(', ') || 'Không có'}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-4 text-center italic text-slate-400">
                Chưa có công việc nào được phân công trong kế hoạch này.
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="border-l-2 border-blue-500 pl-2 text-xs font-bold uppercase tracking-wider text-slate-900">
              Nhân sự tham gia ({plan.staffList.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {plan.staffList.map((s) => (
                <span key={s.name} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                  {s.name} <span className="font-normal text-slate-400">- {s.role}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-slate-200 bg-slate-50 p-5">
          <Button variant="secondary" onClick={onClose}>
            Đóng lại
          </Button>
          <Button onClick={onEdit}>
            <Edit className="h-3.5 w-3.5" />
            Chỉnh sửa kế hoạch
          </Button>
        </div>
      </motion.div>
    </>
  );
}
