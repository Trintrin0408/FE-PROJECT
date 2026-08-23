'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Camera, CheckCircle2, ClipboardList, Eye, ListChecks, MapPin, Users } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar, FilterRow } from '@/components/ui/FilterBar';
import { SearchInput } from '@/components/ui/SearchInput';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import {
  FlatWorkTask,
  PLANNING_STAFF_POOL,
  TASK_STATUS_META,
  TaskStatus,
  getAllAdminWorkTasks,
  updateAdminScheduleTask,
} from '@/mocks/db/schedulePlans';

// Trang thuần giao diện mới — chưa có màn hình admin/coordination tương ứng để mirror (xem
// docs/manager-features-checklist.md mục "Work Task"). Gộp toàn bộ công việc kỹ thuật (PlanWorkTask)
// từ mọi Kế hoạch & phân công (src/mocks/adminSchedulePlansMock.ts) thành 1 bảng độc lập cho Manager
// theo dõi/tái phân công theo từng nhân sự — khác trang Lịch trình vốn nhóm việc theo từng kế hoạch.

type StatusFilter = '' | TaskStatus;

const STATUS_ORDER: TaskStatus[] = ['TODO', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'];

export default function ManagerWorkTaskPage() {
  const [tasks, setTasks] = useState<FlatWorkTask[]>(() => getAllAdminWorkTasks());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [editingTask, setEditingTask] = useState<FlatWorkTask | null>(null);

  const refresh = () => setTasks(getAllAdminWorkTasks());

  const assigneeOptions = useMemo(() => Array.from(new Set(tasks.map((t) => t.assignee))).sort(), [tasks]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (assigneeFilter && t.assignee !== assigneeFilter) return false;
      if (!term) return true;
      return (
        t.title.toLowerCase().includes(term) ||
        t.orderId.toLowerCase().includes(term) ||
        t.customerName.toLowerCase().includes(term) ||
        t.assignee.toLowerCase().includes(term)
      );
    });
  }, [tasks, search, statusFilter, assigneeFilter]);

  const kpis: KpiCardItem[] = [
    { label: 'Tổng công việc', value: tasks.length, icon: ClipboardList, iconColor: 'blue' },
    { label: 'Chưa phân công', value: tasks.filter((t) => t.status === 'TODO').length, icon: ListChecks, iconColor: 'amber' },
    { label: 'Đang thực hiện', value: tasks.filter((t) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length, icon: Users, iconColor: 'blue' },
    { label: 'Hoàn thành', value: tasks.filter((t) => t.status === 'COMPLETED').length, icon: CheckCircle2, iconColor: 'green' },
  ];

  const handleSaveTask = (patch: Partial<FlatWorkTask>) => {
    if (!editingTask) return;
    updateAdminScheduleTask(editingTask.planId, editingTask.id, patch);
    refresh();
    setEditingTask(null);
  };

  const columns: TableColumn<FlatWorkTask>[] = [
    {
      key: 'title',
      label: 'Công việc',
      render: (t) => (
        <div>
          <p className="font-semibold text-slate-800">{t.title}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
            <MapPin className="h-3.5 w-3.5" />
            {t.location}
          </p>
        </div>
      ),
    },
    {
      key: 'order',
      label: 'Đơn đặt / Kế hoạch',
      render: (t) => (
        <div>
          <Link href={`/manager/orders/${t.orderId}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">
            {t.orderId}
          </Link>
          <p className="mt-0.5 text-xs text-slate-400">{t.eventName}</p>
        </div>
      ),
    },
    {
      key: 'assignee',
      label: 'Phụ trách',
      render: (t) => (
        <div>
          <p className="font-medium text-slate-800">{t.assignee}</p>
          {t.team.length > 0 && <p className="mt-0.5 text-xs text-slate-400">+{t.team.length} người đồng hành</p>}
        </div>
      ),
    },
    { key: 'startTime', label: 'Thời gian', render: (t) => <span className="font-mono text-xs text-slate-600">{t.startTime}</span> },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (t) => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TASK_STATUS_META[t.status].badgeClass}`}>{TASK_STATUS_META[t.status].label}</span>
      ),
    },
    {
      key: 'evidence',
      label: 'Minh chứng',
      render: (t) =>
        t.evidencePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.evidencePhotoUrl} alt="Ảnh thi công minh chứng" className="h-9 w-9 rounded-lg object-cover ring-1 ring-slate-200" />
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (t) => (
        <button
          type="button"
          onClick={() => setEditingTask(t)}
          aria-label="Xem / cập nhật công việc"
          title="Xem / cập nhật công việc"
          className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Công việc (Work Task)" icon={<ClipboardList className="h-6 w-6 text-blue-600" />} />

      <div className="mt-6">
        <DashboardStats items={kpis} />
      </div>

      <FilterBar>
        <FilterRow>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Tìm theo tên việc, mã đơn, khách hàng, người phụ trách..."
          />
          <div className="w-52">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              options={[{ value: '', label: 'Tất cả trạng thái' }, ...STATUS_ORDER.map((s) => ({ value: s, label: TASK_STATUS_META[s].label }))]}
            />
          </div>
          <div className="w-52">
            <Select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              options={[{ value: '', label: 'Tất cả người phụ trách' }, ...assigneeOptions.map((a) => ({ value: a, label: a }))]}
            />
          </div>
        </FilterRow>

        <div className="mt-4 overflow-x-auto">
          <Table columns={columns} rows={filtered} rowKey={(row) => `${row.planId}-${row.id}`} />
        </div>
      </FilterBar>

      <TaskEditModal task={editingTask} onClose={() => setEditingTask(null)} onSave={handleSaveTask} />
    </div>
  );
}

interface TaskEditModalProps {
  task: FlatWorkTask | null;
  onClose: () => void;
  onSave: (patch: Partial<FlatWorkTask>) => void;
}

function TaskEditModal({ task, onClose, onSave }: Readonly<TaskEditModalProps>) {
  const [assignee, setAssignee] = useState(task?.assignee ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'TODO');
  const [wasTaskId, setWasTaskId] = useState(task?.id);

  if (task && task.id !== wasTaskId) {
    setWasTaskId(task.id);
    setAssignee(task.assignee);
    setStatus(task.status);
  }

  if (!task) return null;

  return (
    <Modal
      isOpen={Boolean(task)}
      onClose={onClose}
      title={task.title}
      subtitle={`${task.orderId} · ${task.eventName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button onClick={() => onSave({ assignee, status })}>Lưu thay đổi</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            {task.location}
          </p>
          <p className="mt-1">
            Thời gian: <strong className="text-slate-800">{task.startTime}</strong>
          </p>
          {task.requirements && <p className="mt-1 italic text-slate-500">{task.requirements}</p>}
        </div>

        <Select
          label="Người phụ trách chính"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          options={PLANNING_STAFF_POOL.map((s) => ({ value: s.name, label: `${s.name} (${s.role})` }))}
        />

        {task.team.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nhân sự đồng hành</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {task.team.map((name) => (
                <span key={name} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        <Select
          label="Trạng thái"
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
          options={STATUS_ORDER.map((s) => ({ value: s, label: TASK_STATUS_META[s].label }))}
        />

        {task.evidencePhotoUrl && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Camera className="h-3.5 w-3.5" />
              Ảnh minh chứng đã nhận từ hiện trường
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={task.evidencePhotoUrl} alt="Ảnh thi công minh chứng" className="max-h-56 w-full rounded-lg border border-slate-200 object-contain" />
          </div>
        )}
      </div>
    </Modal>
  );
}
